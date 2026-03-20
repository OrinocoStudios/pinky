import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DOCUMENT_REPOSITORY, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { ExtractedGraph } from '../../graph/domain/models/graph.model';

@Injectable()
export class GraphSyncRetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GraphSyncRetryService.name);
  private intervalId?: NodeJS.Timeout;

  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
  ) {}

  onModuleInit(): void {
    this.intervalId = setInterval(() => {
      void this.retry(20).catch((err) => {
        this.logger.error(`Retry cycle failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async retry(limit: number, tenantId?: string): Promise<{ processed: number; synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    let processed = 0;

    for (let i = 0; i < limit; i++) {
      const event = await this.documentRepository.claimAndGetNextRetryableEvent(tenantId);
      if (!event) break;

      try {
        const graph = JSON.parse(event.payload) as ExtractedGraph;
        await this.graphStore.upsertGraph(graph, event.tenantId);
        await this.documentRepository.updateDocumentStatus(event.documentId, 'READY', 'SYNCED');
        await this.documentRepository.markGraphSyncEvent(event.eventId, 'SYNCED', {
          lastError: '',
        });
        synced++;
      } catch (error) {
        const lastError = error instanceof Error ? error.message : 'Unknown graph sync error';
        const finalStatus = event.attempts >= 10 ? 'DEAD_LETTER' : 'FAILED';

        if (finalStatus === 'DEAD_LETTER') {
          this.logger.warn(
            `Outbox event ${event.eventId} (documentId=${event.documentId}) moved to DEAD_LETTER after ${event.attempts} attempts. Last error: ${lastError}`,
          );
        }

        try {
          await this.documentRepository.markGraphSyncEvent(event.eventId, finalStatus, {
            lastError,
          });
        } catch (markError) {
          this.logger.error(
            `Failed to mark event ${event.eventId} as ${finalStatus}: ${markError instanceof Error ? markError.message : String(markError)}`,
          );
        }
        failed++;
      }
      processed++;
    }

    return { processed, synced, failed };
  }
}
