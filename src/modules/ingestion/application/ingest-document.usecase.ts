import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
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
import { ChecksumService } from '../../../common/utils/checksum.service';
import { BrainConfig } from '../../../config/configuration';

export type IngestDocumentInput = {
  tenantId?: string;
  title?: string;
  rawText: string;
  source: DocumentRecord['source'];
  metadata?: Record<string, unknown>;
};

@Injectable()
export class IngestDocumentUseCase {
  private readonly logger = new Logger(IngestDocumentUseCase.name);

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
    private readonly checksumService: ChecksumService,
    private readonly configService: ConfigService<BrainConfig>,
    @InjectMetric('brain_documents_ingested_total')
    private readonly documentsIngestedCounter: Counter<string>,
  ) {}

  async execute(input: IngestDocumentInput): Promise<DocumentRecord> {
    const checksum = this.checksumService.calculate(input.rawText);
    const enableChecksum = this.configService.get('app.enableChecksumValidation', { infer: true });
    if (enableChecksum) {
      const existing = await this.documentRepository.findDocumentByChecksum(checksum, input.tenantId);
      if (existing) {
        this.logger.log(`Document already exists (checksum match): ${existing.documentId}`);
        return existing;
      }
    }

    const documentId = randomUUID();
    const embeddingModel = this.embeddingPort.getModelId();
    const extractionModel = this.graphExtractor.getModelId();
    const docMetadata = {
      ...input.metadata,
      embedding_model: embeddingModel,
      extraction_model: extractionModel,
    };
    let created: DocumentRecord;
    try {
      created = await this.documentRepository.createDocument({
        documentId,
        tenantId: input.tenantId,
        title: input.title,
        rawText: input.rawText,
        source: input.source,
        status: 'RECEIVED',
        graphSyncStatus: 'PENDING',
        checksum,
        metadata: docMetadata,
      });
    } catch (error) {
      if (enableChecksum && this.isDuplicateChecksumError(error)) {
        const existing = await this.documentRepository.findDocumentByChecksum(checksum, input.tenantId);
        if (existing) {
          this.logger.log(
            `Document already exists after concurrent insert attempt (checksum match): ${existing.documentId}`,
          );
          return existing;
        }
      }
      throw error;
    }

    try {
      const chunks = this.chunker.chunk(documentId, input.rawText);
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk) => ({
          ...chunk,
          tenantId: input.tenantId,
          embedding: await this.embeddingPort.embed(chunk.text),
          embeddingModel,
        })),
      );
      await this.documentRepository.addChunks(chunksWithEmbeddings);
      await this.documentRepository.updateDocumentStatus(documentId, 'EMBEDDED', 'PENDING');

      const chunkInputs = chunks.map((c) => ({ chunkId: c.chunkId, text: c.text }));
      const extractedGraph = await this.graphExtractor.extract(documentId, chunkInputs);
      const syncEvent = await this.documentRepository.enqueueGraphSyncEvent(
        documentId,
        extractedGraph,
        input.tenantId,
      );
      await this.graphStore.upsertGraph(extractedGraph, input.tenantId);
      await this.documentRepository.updateDocumentStatus(documentId, 'READY', 'SYNCED');
      await this.documentRepository.markGraphSyncEvent(syncEvent.eventId, 'SYNCED', {
        attempts: 1,
        lastError: '',
      });
      this.documentsIngestedCounter.inc();
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

  private isDuplicateChecksumError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const maybeError = error as { code?: number; message?: string };
    return maybeError.code === 11000 && maybeError.message?.includes('checksum') === true;
  }
}
