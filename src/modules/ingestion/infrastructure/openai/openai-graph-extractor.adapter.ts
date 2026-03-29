import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphExtractorPort, ChunkInput } from '../../domain/ports/graph-extractor.port';
import {
  ExtractedGraph,
  GraphEntity,
  GraphRelationship,
} from '../../../graph/domain/models/graph.model';
import { BrainConfig } from '../../../../config/configuration';
import { createOpenAiClient } from '../../../../common/utils/openai-client';

type ChunkExtraction = {
  entities: Array<{ name: string; type: string; normalized?: string }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    confidence?: number;
  }>;
};

@Injectable()
export class OpenAiGraphExtractorAdapter implements GraphExtractorPort {
  private readonly logger = new Logger(OpenAiGraphExtractorAdapter.name);
  private readonly client: ReturnType<typeof createOpenAiClient>;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const openaiConfig = this.configService.get('llm.openai', { infer: true })!;
    this.client = createOpenAiClient(openaiConfig);
    this.model =
      this.configService.get('llm.openai.extractionModel', {
        infer: true,
      }) ??
      this.configService.get('llm.openai.model', { infer: true }) ??
      'gpt-4o-mini';
    this.maxTokens =
      this.configService.get('llm.openai.maxTokens', {
        infer: true,
      }) ?? 1000;
    this.temperature =
      this.configService.get('llm.openai.temperature', {
        infer: true,
      }) ?? 0.2;
  }

  async extract(documentId: string, chunks: ChunkInput[]): Promise<ExtractedGraph> {
    const allEntities: GraphEntity[] = [];
    const allRelationships: GraphRelationship[] = [];

    for (const chunk of chunks) {
      const extracted = await this.extractFromChunk(documentId, chunk);
      const chunkEntityIds = new Map<string, string>();

      for (const entity of extracted.entities) {
        const entityId = `${entity.normalized ?? entity.name.toLowerCase()}::${documentId}::${chunk.chunkId}`;
        chunkEntityIds.set(entity.name, entityId);

        allEntities.push({
          entityId,
          type: entity.type || 'NamedEntity',
          name: entity.name,
          normalized: entity.normalized ?? entity.name.toLowerCase(),
          attributes: { sourceDocumentId: documentId, sourceChunkId: chunk.chunkId },
        });
      }

      for (const relationship of extracted.relationships) {
        const fromId =
          chunkEntityIds.get(relationship.from) ??
          this.makeEntityId(relationship.from, documentId, chunk.chunkId);
        const toId =
          chunkEntityIds.get(relationship.to) ??
          this.makeEntityId(relationship.to, documentId, chunk.chunkId);

        allRelationships.push({
          fromEntityId: fromId,
          toEntityId: toId,
          type: relationship.type || 'RELATED_TO',
          confidence: Math.min(1, Math.max(0, relationship.confidence ?? 0.5)),
          sourceChunkId: chunk.chunkId,
        });
      }
    }

    return {
      sourceDocumentId: documentId,
      entities: this.deduplicateEntities(allEntities),
      relationships: allRelationships,
    };
  }

  getModelId(): string {
    return this.model;
  }

  private async extractFromChunk(
    documentId: string,
    chunk: ChunkInput,
  ): Promise<ChunkExtraction> {
    if (!this.client) {
      throw new Error(
        'OPENAI_API_KEY is required for OpenAI-compatible extraction unless OPENAI_BASE_URL points to a compatible gateway',
      );
    }

    const prompt = `Extract named entities and their relationships from the following text. Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "entities": [{"name": "string", "type": "string", "normalized": "string"}],
  "relationships": [{"from": "entity name", "to": "entity name", "type": "string", "confidence": 0.0-1.0}]
}

Text:
"""
${chunk.text.slice(0, 4000)}
"""

Rules: Use entity names exactly as they appear. Relationship "from" and "to" must match entity names. Confidence 0-1.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? '';
      const parsed = JSON.parse(this.extractJson(raw)) as ChunkExtraction;

      if (!parsed.entities) parsed.entities = [];
      if (!parsed.relationships) parsed.relationships = [];
      return parsed;
    } catch (error) {
      this.logger.warn(
        `Falling back to empty graph for chunk ${chunk.chunkId} of document ${documentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { entities: [], relationships: [] };
    }
  }

  private extractJson(raw: string): string {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}') + 1;
    if (start >= 0 && end > start) {
      return raw.slice(start, end);
    }
    return raw;
  }

  private makeEntityId(name: string, documentId: string, chunkId: string): string {
    return `${name.toLowerCase().replace(/\s+/g, '_')}::${documentId}::${chunkId}`;
  }

  private deduplicateEntities(entities: GraphEntity[]): GraphEntity[] {
    const seen = new Set<string>();
    return entities.filter((entity) => {
      const key = `${entity.normalized ?? entity.name.toLowerCase()}::${entity.attributes?.sourceChunkId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
