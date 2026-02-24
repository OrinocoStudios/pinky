import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphExtractorPort, ChunkInput } from '../../domain/ports/graph-extractor.port';
import {
  ExtractedGraph,
  GraphEntity,
  GraphRelationship,
} from '../../../graph/domain/models/graph.model';
import { BrainConfig } from '../../../../config/configuration';

type OllamaGenerateResponse = {
  response?: string;
};

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
export class OllamaGraphExtractorAdapter implements GraphExtractorPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const ollama = configService.get('ollama', { infer: true });
    this.baseUrl = ollama?.baseUrl ?? 'http://localhost:11434';
    this.model = ollama?.extractionModel ?? 'llama3.2';
    this.timeoutMs = ollama?.timeoutMs ?? 60000;
  }

  async extract(documentId: string, chunks: ChunkInput[]): Promise<ExtractedGraph> {
    const allEntities: GraphEntity[] = [];
    const allRelationships: GraphRelationship[] = [];
    const entityIdMap = new Map<string, string>(); // normalized name -> entityId

    for (const chunk of chunks) {
      const extracted = await this.extractFromChunk(documentId, chunk);
      const chunkEntityIds = new Map<string, string>();

      for (const e of extracted.entities) {
        const key = `${e.normalized ?? e.name.toLowerCase()}::${chunk.chunkId}`;
        const entityId = `${e.normalized ?? e.name.toLowerCase()}::${documentId}::${chunk.chunkId}`;
        chunkEntityIds.set(e.name, entityId);
        entityIdMap.set(key, entityId);

        allEntities.push({
          entityId,
          type: e.type || 'NamedEntity',
          name: e.name,
          normalized: e.normalized ?? e.name.toLowerCase(),
          attributes: { sourceDocumentId: documentId, sourceChunkId: chunk.chunkId },
        });
      }

      for (const r of extracted.relationships) {
        const fromId = chunkEntityIds.get(r.from) ?? this.makeEntityId(r.from, documentId, chunk.chunkId);
        const toId = chunkEntityIds.get(r.to) ?? this.makeEntityId(r.to, documentId, chunk.chunkId);
        allRelationships.push({
          fromEntityId: fromId,
          toEntityId: toId,
          type: r.type || 'RELATED_TO',
          confidence: Math.min(1, Math.max(0, r.confidence ?? 0.5)),
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
    const schema = `{
  "entities": [{"name": "string", "type": "string", "normalized": "string"}],
  "relationships": [{"from": "entity name", "to": "entity name", "type": "string", "confidence": 0.0-1.0}]
}`;

    const prompt = `Extract named entities and their relationships from the following text. Return ONLY valid JSON matching this schema (no markdown, no explanation):
${schema}

Text:
"""
${chunk.text.slice(0, 4000)}
"""

Rules: Use entity names exactly as they appear. Relationship "from" and "to" must match entity names. Confidence 0-1.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Ollama generate failed (${res.status}): ${errBody}`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      const raw = data.response?.trim() ?? '';
      const jsonStr = this.extractJson(raw);
      const parsed = JSON.parse(jsonStr) as ChunkExtraction;

      if (!parsed.entities) parsed.entities = [];
      if (!parsed.relationships) parsed.relationships = [];
      return parsed;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(`Ollama extraction timeout after ${this.timeoutMs}ms`);
        }
        throw err;
      }
      throw new Error('Ollama extraction failed');
    } finally {
      clearTimeout(timeoutId);
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
    return entities.filter((e) => {
      const key = `${e.normalized ?? e.name.toLowerCase()}::${e.attributes?.sourceChunkId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
