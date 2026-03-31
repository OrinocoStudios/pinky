import { Inject, Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import {
  ANSWER_GENERATOR_PORT,
  CHUNK_SEARCH_PORT,
  DOCUMENT_REPOSITORY,
  GRAPH_STORE_PORT,
  CHAT_HISTORY_REPOSITORY,
} from '../../../shared/di.tokens';
import { ChunkSearchPort } from '../../search/domain/ports/chunk-search.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { PromptTemplateService } from './prompt-template.service';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { ChatHistoryRepositoryPort } from '../domain/ports/chat-history.repository.port';

export type GraphRagQueryInput = {
  tenantId?: string;
  libraryIds?: string[];
  query: string;
  entityHints?: string[];
  topK: number;
  sessionId?: string;
};

export type GraphRagQueryOutput = {
  prompt: string;
  answer: string;
  sourcesUsed: string[];
  fastContext: Array<{
    id: string;
    text: string;
    documentId?: string;
    title?: string;
    libraryId?: string;
    metadata?: Record<string, unknown>;
  }>;
  truthFacts: Array<{ id: string; from: string; relation: string; to: string }>;
  model?: string;
  tokensUsed?: number;
};

@Injectable()
export class GraphRagQueryUseCase {
  constructor(
    @Inject(CHUNK_SEARCH_PORT)
    private readonly chunkSearch: ChunkSearchPort,
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
    @Inject(ANSWER_GENERATOR_PORT)
    private readonly answerGenerator: AnswerGeneratorPort,
    @Inject(CHAT_HISTORY_REPOSITORY)
    private readonly chatHistory: ChatHistoryRepositoryPort,
    private readonly promptTemplate: PromptTemplateService,
    private readonly logger: StructuredLogger,
    @InjectMetric('brain_queries_total')
    private readonly queriesTotalCounter: Counter<string>,
    @InjectMetric('brain_query_errors_total')
    private readonly queryErrorsCounter: Counter<string>,
    @InjectMetric('brain_query_latency_ms')
    private readonly queryLatencyHistogram: Histogram<string>,
  ) {}

  async execute(input: GraphRagQueryInput): Promise<GraphRagQueryOutput> {
    const startTime = Date.now();
    this.queriesTotalCounter.inc();

    // Persist user message if sessionId is present
    if (input.sessionId) {
      this.chatHistory.saveMessage({
        sessionId: input.sessionId,
        libraryId: input.libraryIds?.[0],
        role: 'user',
        content: input.query,
      }).catch((err: any) => this.logger.error(`Failed to save user message: ${err.message}`));
    }

    const libraryIds = this.normalizeLibraryIds(input.libraryIds);

    try {
      // Step 1: Retrieve chunks from search engine
      const chunks = await this.chunkSearch.hybridSearch({
        tenantId: input.tenantId,
        libraryIds,
        queryText: input.query,
        topK: input.topK,
      });
      const documentIds = [...new Set(chunks.map((chunk: any) => chunk.documentId).filter(Boolean))];
      const documents = await Promise.all(
        documentIds.map(async (documentId: string) => ({
          documentId,
          document: await this.documentRepository.findDocumentById(documentId),
        })),
      );
      const documentMap = new Map(
        documents
          .filter((entry: any) => entry.document)
          .map((entry: any) => [entry.documentId, entry.document]),
      );

      this.logger.debug('Retrieved chunks for query', GraphRagQueryUseCase.name, {
        chunks: chunks.length,
      });

      // Step 2: Extract entity hints and query graph
      const entityHints = input.entityHints?.length
        ? input.entityHints
        : this.extractEntityHintsFromQuery(input.query);
      const entities = await this.graphStore.findEntitiesByNames(entityHints, input.tenantId, libraryIds);
      const relations = await this.graphStore.findRelationshipsForEntityIds(
        entities.map((e: any) => e.entityId),
        input.tenantId,
        libraryIds,
      );

      this.logger.debug('Retrieved graph context for query', GraphRagQueryUseCase.name, {
        entities: entities.length,
        relations: relations.length,
      });

      // Step 3: Build grounded prompt with IDs
      const contextSources = chunks.map((chunk: any) => ({
        chunkId: chunk.chunkId,
        id: chunk.chunkId,
        text: chunk.text,
        documentId: chunk.documentId,
        title: documentMap.get(chunk.documentId)?.title,
        libraryId: chunk.libraryId ?? documentMap.get(chunk.documentId)?.libraryId,
        metadata: documentMap.get(chunk.documentId)?.metadata,
      }));

      const graphFacts = relations.map((rel: any) => ({
        id: rel.sourceChunkId,
        fromEntityId: rel.fromEntityId,
        type: rel.type,
        toEntityId: rel.toEntityId,
        confidence: rel.confidence,
      }));

      const { prompt, sources } = this.promptTemplate.buildGroundedPrompt({
        query: input.query,
        contextSources,
        graphFacts,
      });

      // Step 4: Generate answer with LLM
      const result = await this.answerGenerator.generate({
        prompt,
        sources,
        maxTokens: undefined, // Use default from config
      });

      // Persist assistant message if sessionId is present
      if (input.sessionId) {
        this.chatHistory.saveMessage({
          sessionId: input.sessionId,
          libraryId: input.libraryIds?.[0],
          role: 'assistant',
          content: result.answer,
        }).catch((err: any) => this.logger.error(`Failed to save assistant message: ${err.message}`));
      }

      const latency = Date.now() - startTime;
      this.queryLatencyHistogram.observe(latency);
      this.logger.log('GraphRAG query completed', GraphRagQueryUseCase.name, {
        latencyMs: latency,
        model: result.model,
        tokensUsed: result.tokensUsed,
        sourcesCited: result.sourcesUsed.length,
      });

      return {
        prompt,
        answer: result.answer,
        sourcesUsed: result.sourcesUsed,
        fastContext: contextSources.map((source: any) => ({
          id: source.id,
          text: source.text,
          documentId: source.documentId,
          title: source.title,
          libraryId: source.libraryId,
          metadata: source.metadata,
        })),
        truthFacts: graphFacts.map((f: any) => ({
          id: f.id,
          from: f.fromEntityId,
          relation: f.type,
          to: f.toEntityId,
        })),
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.queryErrorsCounter.inc();
      this.queryLatencyHistogram.observe(latency);
      this.logger.error(
        'GraphRAG query failed',
        error instanceof Error ? error.stack : undefined,
        GraphRagQueryUseCase.name,
        {
          latencyMs: latency,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }

  private extractEntityHintsFromQuery(query: string): string[] {
    const cleaned = query
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 3);
    return [...new Set(cleaned)].slice(0, 8);
  }

  private normalizeLibraryIds(libraryIds?: string[]): string[] | undefined {
    const normalized = [...new Set((libraryIds ?? []).map((libraryId) => libraryId.trim()).filter(Boolean))];
    return normalized.length > 0 ? normalized : undefined;
  }
}
