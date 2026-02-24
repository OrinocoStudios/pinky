import { Inject, Injectable, Logger } from '@nestjs/common';
import { ANSWER_GENERATOR_PORT, CHUNK_SEARCH_PORT, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { ChunkSearchPort } from '../../search/domain/ports/chunk-search.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { PromptTemplateService } from './prompt-template.service';

export type GraphRagQueryInput = {
  query: string;
  entityHints?: string[];
  topK: number;
};

export type GraphRagQueryOutput = {
  prompt: string;
  answer: string;
  sourcesUsed: string[];
  fastContext: Array<{ id: string; text: string }>;
  truthFacts: Array<{ id: string; from: string; relation: string; to: string }>;
  model?: string;
  tokensUsed?: number;
};

@Injectable()
export class GraphRagQueryUseCase {
  private readonly logger = new Logger(GraphRagQueryUseCase.name);

  constructor(
    @Inject(CHUNK_SEARCH_PORT)
    private readonly chunkSearch: ChunkSearchPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
    @Inject(ANSWER_GENERATOR_PORT)
    private readonly answerGenerator: AnswerGeneratorPort,
    private readonly promptTemplate: PromptTemplateService,
  ) {}

  async execute(input: GraphRagQueryInput): Promise<GraphRagQueryOutput> {
    const startTime = Date.now();

    try {
      // Step 1: Retrieve chunks from search engine
      const chunks = await this.chunkSearch.hybridSearch({
        queryText: input.query,
        topK: input.topK,
      });

      this.logger.debug(`Retrieved ${chunks.length} chunks`);

      // Step 2: Extract entity hints and query graph
      const entityHints = input.entityHints?.length
        ? input.entityHints
        : this.extractEntityHintsFromQuery(input.query);
      const entities = await this.graphStore.findEntitiesByNames(entityHints);
      const relations = await this.graphStore.findRelationshipsForEntityIds(
        entities.map((e) => e.entityId),
      );

      this.logger.debug(`Retrieved ${entities.length} entities and ${relations.length} relations`);

      // Step 3: Build grounded prompt with IDs
      const contextSources = chunks.map((chunk, index) => ({
        id: chunk.chunkId,
        text: chunk.text,
      }));

      const graphFacts = relations.map((rel) => ({
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

      const latency = Date.now() - startTime;
      this.logger.log(
        `Query completed in ${latency}ms, model=${result.model}, tokens=${result.tokensUsed}, sources_cited=${result.sourcesUsed.length}`,
      );

      return {
        prompt,
        answer: result.answer,
        sourcesUsed: result.sourcesUsed,
        fastContext: contextSources,
        truthFacts: graphFacts.map((f) => ({
          id: f.id,
          from: f.fromEntityId,
          relation: f.type,
          to: f.toEntityId,
        })),
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error(`Query failed after ${latency}ms: ${error}`);

      // Fallback response on error
      return {
        prompt: '',
        answer: `Lo siento, ocurrió un error al procesar tu consulta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        sourcesUsed: [],
        fastContext: [],
        truthFacts: [],
      };
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
}
