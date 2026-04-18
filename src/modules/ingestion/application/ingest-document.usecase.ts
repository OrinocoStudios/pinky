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
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

export type IngestDocumentInput = {
  tenantId?: string;
  libraryId?: string;
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
    private readonly events: StructuredLogger,
  ) {}

  async execute(input: IngestDocumentInput): Promise<DocumentRecord> {
    this.logger.log(`Ingesting document: ${input.title || 'untitled'}`);
    const startedAt = Date.now();
    const checksum = this.checksumService.calculate(input.rawText);
    const ingestKey = this.buildIngestKey(checksum, input.tenantId, input.libraryId);
    const enableChecksum = this.configService.get('app.enableChecksumValidation', { infer: true });

    if (enableChecksum) {
      try {
        const existing = await this.documentRepository.findDocumentByIngestKey(
          ingestKey,
          input.tenantId,
          input.libraryId,
        );
        if (existing) {
          this.logger.log(`Document already exists (ingestKey match): ${existing.documentId}`);
          return existing;
        }
      } catch (err) {
        this.logger.error(`Error checking for existing document: ${err instanceof Error ? err.message : String(err)}`);
        // Fall through to try create it anyway
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
      this.logger.log(`Creating document record in Neo4j: ${documentId}`);
      created = await this.documentRepository.createDocument({
        documentId,
        ingestKey,
        tenantId: input.tenantId,
        libraryId: input.libraryId,
        title: input.title,
        rawText: input.rawText,
        source: input.source,
        status: 'RECEIVED',
        graphSyncStatus: 'PENDING',
        checksum,
        metadata: docMetadata,
      });
    } catch (error) {
      if (enableChecksum && this.isDuplicateIngestKeyError(error)) {
        const existing = await this.documentRepository.findDocumentByIngestKey(
          ingestKey,
          input.tenantId,
          input.libraryId,
        );
        if (existing) {
          this.logger.log(
            `Document already exists after concurrent insert attempt (ingestKey match): ${existing.documentId}`,
          );
          return existing;
        }
      }
      this.logger.error(`Failed to create document record: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    try {
      this.logger.log(`Chunking document: ${documentId}`);
      const chunks = this.chunker.chunk(documentId, input.rawText);
      this.logger.log(`Generated ${chunks.length} chunks`);

      this.logger.log(`Generating embeddings for chunks (sequential loop)...`);
      const chunksWithEmbeddings = [];
      let embeddedCount = 0;
      for (const chunk of chunks) {
        const embedding = await this.embeddingPort.embed(chunk.text);
        chunksWithEmbeddings.push({
          ...chunk,
          tenantId: input.tenantId,
          libraryId: input.libraryId,
          embedding,
          embeddingModel,
        });
        embeddedCount++;
        if (embeddedCount % 10 === 0) {
          this.logger.log(`Progress: ${embeddedCount}/${chunks.length} embeddings generated`);
        }
      }

      this.logger.log(`Persisting chunks into Neo4j document store: ${chunks.length} chunks`);
      await this.documentRepository.addChunks(chunksWithEmbeddings);

      await this.documentRepository.updateDocumentStatus(documentId, 'EMBEDDED', 'PENDING');

      this.logger.log(`Extracting graph entities and relations...`);
      const chunkInputs = chunks.map((c) => ({ chunkId: c.chunkId, text: c.text }));
      const extractedGraph = await this.graphExtractor.extract(documentId, chunkInputs);
      
      this.logger.log(`Upserting graph context into Neo4j...`);
      await this.graphStore.upsertGraph(extractedGraph, input.tenantId, input.libraryId);
      
      this.logger.log(`Linking chunks to entities in Neo4j...`);
      await this.graphStore.linkChunksToEntities(extractedGraph);
      
      await this.documentRepository.updateDocumentStatus(documentId, 'READY', 'SYNCED');
      this.documentsIngestedCounter.inc();
      this.events.event('DocumentIngested', {
        documentId,
        tenantId: input.tenantId,
        libraryId: input.libraryId,
        chunks: chunks.length,
        embeddingModel,
        extractionModel,
        latencyMs: Date.now() - startedAt,
        sourceKind: input.source?.kind,
      });
      this.logger.log(`Document ingestion completed successfully: ${documentId}`);
    } catch (error) {
      this.logger.error(`Error during ingestion pipeline for document ${documentId}: ${error instanceof Error ? error.message : String(error)}`);
      await this.documentRepository.updateDocumentStatus(documentId, 'ERROR', 'FAILED');
      this.events.event('DocumentIngestFailed', {
        documentId,
        tenantId: input.tenantId,
        libraryId: input.libraryId,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new InternalServerErrorException({
        message: 'Document ingestion failed',
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return (await this.documentRepository.findDocumentById(documentId)) ?? created;
  }

  private buildIngestKey(checksum: string, tenantId?: string, libraryId?: string): string {
    return this.checksumService.calculate(`${tenantId ?? ''}|${libraryId ?? ''}|${checksum}`);
  }

  private isDuplicateIngestKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const maybeError = error as { code?: number | string; message?: string };
    const message = maybeError.message ?? '';
    return (
      maybeError.code === 11000 ||
      /constraint/i.test(message) ||
      /ingestkey/i.test(message) ||
      /document_ingest_key/i.test(message)
    );
  }
}
