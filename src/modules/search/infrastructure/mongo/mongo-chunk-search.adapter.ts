import { Inject, Injectable } from '@nestjs/common';
import { DocumentChunk } from '../../../documents/domain/models/document.model';
import { ChunkSearchPort, ChunkSearchQuery } from '../../domain/ports/chunk-search.port';
import { MongoDatabaseService } from '../../../documents/infrastructure/mongo/mongo-database.service';
import { EmbeddingPort } from '../../../ingestion/domain/ports/embedding.port';
import { EMBEDDING_PORT } from '../../../../shared/di.tokens';

@Injectable()
export class MongoChunkSearchAdapter implements ChunkSearchPort {
  constructor(
    private readonly db: MongoDatabaseService,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
  ) {}

  async hybridSearch(query: ChunkSearchQuery): Promise<DocumentChunk[]> {
    const queryVector = await this.embeddingPort.embed(query.queryText);
    const queryDim = queryVector.length;
    const candidateChunks = (await this.db.chunksCollection
      .find({})
      .limit(Math.max(query.topK * 8, 200))
      .toArray()) as unknown as DocumentChunk[];

    const scored = candidateChunks.map((chunk) => {
      const embedding = chunk.embedding;
      const hasValidVector =
        Array.isArray(embedding) &&
        embedding.length === queryDim &&
        embedding.length > 0;
      const vectorScore = hasValidVector
        ? this.cosineSimilarity(queryVector, embedding)
        : 0;
      const textScore = this.textOverlapScore(query.queryText, chunk.text);
      const score = hasValidVector
        ? vectorScore * 0.8 + textScore * 0.2
        : textScore;
      return { chunk, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK)
      .map((entry) => entry.chunk);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private textOverlapScore(query: string, text: string): number {
    const qTerms = new Set(query.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
    if (qTerms.size === 0) {
      return 0;
    }

    const tTerms = new Set(text.toLowerCase().split(/\W+/));
    let overlap = 0;
    qTerms.forEach((term) => {
      if (tTerms.has(term)) {
        overlap += 1;
      }
    });
    return overlap / qTerms.size;
  }
}
