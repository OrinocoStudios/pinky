import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { ExtractedGraph } from '../../graph/domain/models/graph.model';

@Injectable()
export class GraphSyncRetryService implements OnModuleInit, OnModuleDestroy {
  private intervalId?: NodeJS.Timeout;

  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
  ) {}

  onModuleInit(): void {
    this.intervalId = setInterval(() => {
      void this.retry(20);
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async retry(limit: number): Promise<{ processed: number; synced: number; failed: number }> {
    const events = await this.documentRepository.getRetryableGraphSyncEvents(limit);
    let synced = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const graph = JSON.parse(event.payload) as ExtractedGraph;
        await this.graphStore.upsertGraph(graph);
        await this.documentRepository.markGraphSyncEvent(event.eventId, 'SYNCED', {
          attempts: event.attempts + 1,
          lastError: '',
        });
        await this.documentRepository.updateDocumentStatus(event.documentId, 'READY', 'SYNCED');
        synced++;
      } catch (error) {
        await this.documentRepository.markGraphSyncEvent(event.eventId, 'FAILED', {
          attempts: event.attempts + 1,
          lastError: error instanceof Error ? error.message : 'Unknown graph sync error',
        });
        failed++;
      }
    }

    return { processed: events.length, synced, failed };
  }
}
