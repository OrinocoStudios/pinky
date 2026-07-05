import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import {
  ANSWER_GENERATOR_PORT,
  CHUNK_SEARCH_PORT,
  DOCUMENT_REPOSITORY,
  GRAPH_STORE_PORT,
  CHAT_HISTORY_REPOSITORY,
  QUERY_DOCUMENT_ANALYTICS_REPOSITORY,
} from '../../../shared/di.tokens';
import { ChunkSearchPort, ScoredChunk } from '../../search/domain/ports/chunk-search.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { ChunkScoreFilterService } from './chunk-score-filter.service';
import { PromptTemplateService } from './prompt-template.service';
import { BrainConfig } from '../../../config/configuration';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { ChatHistoryRepositoryPort } from '../domain/ports/chat-history.repository.port';
import { QueryDocumentAnalyticsRepositoryPort } from '../domain/ports/query-document-analytics.repository.port';

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
    score?: number;
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
    @Inject(QUERY_DOCUMENT_ANALYTICS_REPOSITORY)
    private readonly queryDocumentAnalyticsRepository: QueryDocumentAnalyticsRepositoryPort,
    private readonly promptTemplate: PromptTemplateService,
    private readonly chunkScoreFilter: ChunkScoreFilterService,
    private readonly configService: ConfigService<BrainConfig>,
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
        tenantId: input.tenantId,
        libraryId: input.libraryIds?.[0],
        role: 'user',
        content: input.query,
      }).catch((err: any) => this.logger.error(`Failed to save user message: ${err.message}`));
    }

    const libraryIds = this.normalizeLibraryIds(input.libraryIds);

    try {
      // Step 1: Retrieve chunks from search engine
      const retrievedChunks = await this.chunkSearch.hybridSearch({
        tenantId: input.tenantId,
        libraryIds,
        queryText: input.query,
        topK: input.topK,
      });
      const chunks = this.filterChunksByScore(retrievedChunks);
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
      const retrievedDocuments = [
        ...new Map(
          chunks
            .filter((chunk: any) => Boolean(chunk.documentId))
            .map((chunk: any) => {
              const mappedDocument = documentMap.get(chunk.documentId);
              return [
                String(chunk.documentId),
                {
                  documentId: String(chunk.documentId),
                  title: mappedDocument?.title,
                  libraryId: chunk.libraryId ?? mappedDocument?.libraryId,
                },
              ] as const;
            }),
        ).values(),
      ];
      this.queryDocumentAnalyticsRepository
        .saveRetrievedDocuments({
          queryExecutionId: randomUUID(),
          createdAt: new Date().toISOString(),
          tenantId: input.tenantId,
          libraryId: libraryIds?.[0],
          documents: retrievedDocuments,
        })
        .catch((error: unknown) =>
          this.logger.error(
            `Failed to save query document analytics: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );

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
        score: chunk.score,
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
          tenantId: input.tenantId,
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
      this.logger.event('QueryExecuted', {
        tenantId: input.tenantId,
        libraryIds,
        sessionId: input.sessionId,
        queryLength: input.query.length,
        topK: input.topK,
        chunksRetrieved: chunks.length,
        entitiesRetrieved: entities.length,
        relationsRetrieved: relations.length,
        sourcesCited: result.sourcesUsed.length,
        model: result.model,
        tokensUsed: result.tokensUsed,
        latencyMs: latency,
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
          score: source.score,
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

  private filterChunksByScore(chunks: ScoredChunk[]): ScoredChunk[] {
    const relativeMargin = this.configService.get('app.scoreRelativeMargin', { infer: true }) ?? 0;
    const minScore = this.configService.get('app.scoreMin', { infer: true }) ?? 0;
    const kept = this.chunkScoreFilter.filter(chunks, { relativeMargin, minScore });

    const scores = chunks
      .map((chunk) => chunk.score)
      .filter((score): score is number => Number.isFinite(score));
    this.logger.debug('Chunk score filter applied', GraphRagQueryUseCase.name, {
      retrieved: chunks.length,
      kept: kept.length,
      bestScore: scores.length ? Math.max(...scores) : undefined,
      worstScore: scores.length ? Math.min(...scores) : undefined,
      relativeMargin,
      minScore,
    });

    return kept;
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
