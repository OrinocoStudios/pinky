import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DOCUMENT_REPOSITORY,
  EMBEDDING_PORT,
  GRAPH_EXTRACTOR_PORT,
  GRAPH_STORE_PORT,
} from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { DocumentRecord } from '../../documents/domain/models/document.model';
import { EmbeddingPort } from '../domain/ports/embedding.port';
import { GraphExtractorPort } from '../domain/ports/graph-extractor.port';
import { SimpleChunkerService } from './simple-chunker.service';

export type IngestDocumentInput = {
  title?: string;
  rawText: string;
  source: DocumentRecord['source'];
  metadata?: Record<string, unknown>;
};

@Injectable()
export class IngestDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
    @Inject(GRAPH_EXTRACTOR_PORT)
    private readonly graphExtractor: GraphExtractorPort,
    private readonly chunker: SimpleChunkerService,
  ) {}

  async execute(input: IngestDocumentInput): Promise<DocumentRecord> {
    const documentId = randomUUID();
    const embeddingModel = this.embeddingPort.getModelId();
    const extractionModel = this.graphExtractor.getModelId();
    const docMetadata = {
      ...input.metadata,
      embedding_model: embeddingModel,
      extraction_model: extractionModel,
    };

    const created = await this.documentRepository.createDocument({
      documentId,
      title: input.title,
      rawText: input.rawText,
      source: input.source,
      status: 'RECEIVED',
      graphSyncStatus: 'PENDING',
      metadata: docMetadata,
    });

    try {
      const chunks = this.chunker.chunk(documentId, input.rawText);
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk) => ({
          ...chunk,
          embedding: await this.embeddingPort.embed(chunk.text),
          embeddingModel,
        })),
      );
      await this.documentRepository.addChunks(chunksWithEmbeddings);
      await this.documentRepository.updateDocumentStatus(documentId, 'EMBEDDED', 'PENDING');

      const chunkInputs = chunks.map((c) => ({ chunkId: c.chunkId, text: c.text }));
      const extractedGraph = await this.graphExtractor.extract(documentId, chunkInputs);
      const syncEvent = await this.documentRepository.enqueueGraphSyncEvent(documentId, extractedGraph);
      await this.graphStore.upsertGraph(extractedGraph);
      await this.documentRepository.markGraphSyncEvent(syncEvent.eventId, 'SYNCED', {
        attempts: 1,
        lastError: '',
      });
      await this.documentRepository.updateDocumentStatus(documentId, 'READY', 'SYNCED');
    } catch (error) {
      await this.documentRepository.updateDocumentStatus(documentId, 'ERROR', 'FAILED');
      throw new InternalServerErrorException({
        message: 'Document ingested in NoSQL but graph sync failed',
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return (await this.documentRepository.findDocumentById(documentId)) ?? created;
  }
}
