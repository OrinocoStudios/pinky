import { Inject, Injectable } from '@nestjs/common';
import { ChunkSearchPort, ChunkSearchQuery, ScoredChunk } from '../../domain/ports/chunk-search.port';
import { EmbeddingPort } from '../../../ingestion/domain/ports/embedding.port';
import { Neo4jConnectionService } from '../../../graph/infrastructure/neo4j/neo4j-connection.service';
import { EMBEDDING_PORT } from '../../../../shared/di.tokens';

@Injectable()
export class Neo4jChunkSearchAdapter implements ChunkSearchPort {
  constructor(
    private readonly neo4j: Neo4jConnectionService,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
  ) {}

  async hybridSearch(query: ChunkSearchQuery): Promise<ScoredChunk[]> {
    const queryVector = await this.embeddingPort.embed(query.queryText, 'query');

    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        CALL db.index.vector.queryNodes('chunk_embedding_index', $topK, $queryVector)
        YIELD node, score
        WHERE ($tenantId IS NULL OR node.tenantId = $tenantId)
          AND ($libraryFilterOff OR node.libraryId IN $libraryIds)
        RETURN node.chunkId      AS chunkId,
               node.documentId   AS documentId,
               node.tenantId     AS tenantId,
               node.libraryId    AS libraryId,
               node.seq          AS seq,
               node.text         AS text,
               node.embedding    AS embedding,
               node.embeddingModel AS embeddingModel,
               node.updatedAt    AS createdAt,
               score
        `,
        {
          topK: query.topK,
          queryVector,
          tenantId: query.tenantId ?? null,
          libraryIds: query.libraryIds ?? [],
          libraryFilterOff: !query.libraryIds?.length,
        },
      );

      return result.records.map((record) => ({
        chunkId: record.get('chunkId'),
        documentId: record.get('documentId'),
        tenantId: record.get('tenantId') ?? undefined,
        libraryId: record.get('libraryId') ?? undefined,
        seq: typeof record.get('seq')?.toNumber === 'function'
          ? record.get('seq').toNumber()
          : Number(record.get('seq') ?? 0),
        text: record.get('text'),
        embedding: record.get('embedding') ?? undefined,
        embeddingModel: record.get('embeddingModel') ?? undefined,
        createdAt: record.get('createdAt') ?? new Date().toISOString(),
        score: this.toScore(record.get('score')),
      }));
    } finally {
      await session.close();
    }
  }

  private toScore(raw: unknown): number | undefined {
    if (raw == null) {
      return undefined;
    }
    const value = typeof (raw as { toNumber?: () => number }).toNumber === 'function'
      ? (raw as { toNumber: () => number }).toNumber()
      : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
}
