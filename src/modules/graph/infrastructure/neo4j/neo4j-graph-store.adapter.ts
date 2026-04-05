import { Injectable } from '@nestjs/common';
import { int } from 'neo4j-driver';
import { GraphStorePort, ChunkWithEmbedding } from '../../domain/ports/graph-store.port';
import { ExtractedGraph, GraphEntity, GraphRelationship } from '../../domain/models/graph.model';
import { Neo4jConnectionService } from './neo4j-connection.service';

@Injectable()
export class Neo4jGraphStoreAdapter implements GraphStorePort {
  constructor(private readonly neo4j: Neo4jConnectionService) {}

  async ping(): Promise<void> {
    await this.neo4j.ping();
  }

  async upsertGraph(graph: ExtractedGraph, tenantId?: string, libraryId?: string): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      const now = new Date().toISOString();
      if (graph.sourceDocumentId) {
        await session.run(
          `
          MERGE (d:Document {documentId: $documentId})
          SET d.updatedAt = $updatedAt,
              d.tenantId = $tenantId,
              d.libraryId = $libraryId
          `,
          {
            documentId: graph.sourceDocumentId,
            updatedAt: now,
            tenantId: tenantId ?? null,
            libraryId: libraryId ?? null,
          },
        );
      }

      for (const entity of graph.entities) {
        await session.run(
          `
          MERGE (e:Entity {entityId: $entityId})
          SET e.name = $name,
              e.type = $type,
              e.normalized = $normalized,
              e.updatedAt = $updatedAt,
              e.tenantId = $tenantId,
              e.libraryId = $libraryId
          `,
          {
            entityId: entity.entityId,
            name: entity.name,
            type: entity.type,
            normalized: entity.normalized ?? entity.name.toLowerCase(),
            updatedAt: now,
            tenantId: tenantId ?? null,
            libraryId: libraryId ?? null,
          },
        );

        if (graph.sourceDocumentId) {
          await session.run(
            `
            MATCH (d:Document {documentId: $documentId})
            MATCH (e:Entity {entityId: $entityId})
            MERGE (d)-[m:MENTIONS]->(e)
            SET m.tenantId = $tenantId,
                m.libraryId = $libraryId
            `,
            {
              documentId: graph.sourceDocumentId,
              entityId: entity.entityId,
              tenantId: tenantId ?? null,
              libraryId: libraryId ?? null,
            },
          );
        }
      }

      for (const relation of graph.relationships) {
        await session.run(
          `
          MATCH (a:Entity {entityId: $fromEntityId})
          MATCH (b:Entity {entityId: $toEntityId})
          MERGE (a)-[r:RELATED {type: $type, sourceChunkId: $sourceChunkId}]->(b)
          SET r.confidence = $confidence,
              r.updatedAt = $updatedAt,
              r.tenantId = $tenantId,
              r.libraryId = $libraryId
          `,
          {
            fromEntityId: relation.fromEntityId,
            toEntityId: relation.toEntityId,
            type: relation.type,
            sourceChunkId: relation.sourceChunkId,
            confidence: relation.confidence,
            updatedAt: now,
            tenantId: tenantId ?? null,
            libraryId: libraryId ?? null,
          },
        );
      }
    } finally {
      await session.close();
    }
  }

  async findEntitiesByNames(
    names: string[],
    tenantId?: string,
    libraryIds?: string[],
  ): Promise<GraphEntity[]> {
    if (names.length === 0) {
      return [];
    }
    const normalizedLibraryIds = this.normalizeLibraryIds(libraryIds);

    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity)
        WHERE toLower(e.name) IN $names
          AND ($tenantId IS NULL OR e.tenantId = $tenantId)
          AND ($libraryFilterOff OR e.libraryId IN $libraryIds)
        RETURN e.entityId AS entityId, e.type AS type, e.name AS name, e.normalized AS normalized
        LIMIT 50
        `,
        {
          names: names.map((name) => name.toLowerCase()),
          tenantId: tenantId ?? null,
          libraryIds: normalizedLibraryIds,
          libraryFilterOff: normalizedLibraryIds.length === 0,
        },
      );

      return result.records.map((record) => ({
        entityId: record.get('entityId'),
        type: record.get('type'),
        name: record.get('name'),
        normalized: record.get('normalized') ?? undefined,
      }));
    } finally {
      await session.close();
    }
  }

  async findRelationshipsForEntityIds(
    entityIds: string[],
    tenantId?: string,
    libraryIds?: string[],
  ): Promise<GraphRelationship[]> {
    if (entityIds.length === 0) {
      return [];
    }
    const normalizedLibraryIds = this.normalizeLibraryIds(libraryIds);

    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (a:Entity)-[r:RELATED]->(b:Entity)
        WHERE (a.entityId IN $entityIds OR b.entityId IN $entityIds)
          AND ($tenantId IS NULL OR r.tenantId = $tenantId)
          AND ($libraryFilterOff OR r.libraryId IN $libraryIds)
        RETURN a.entityId AS fromEntityId,
               b.entityId AS toEntityId,
               r.type AS type,
               r.sourceChunkId AS sourceChunkId,
               r.confidence AS confidence
        LIMIT 100
        `,
        {
          entityIds,
          tenantId: tenantId ?? null,
          libraryIds: normalizedLibraryIds,
          libraryFilterOff: normalizedLibraryIds.length === 0,
        },
      );

      return result.records.map((record) => ({
        fromEntityId: record.get('fromEntityId'),
        toEntityId: record.get('toEntityId'),
        type: record.get('type'),
        sourceChunkId: record.get('sourceChunkId') ?? 'unknown',
        confidence: Number(record.get('confidence') ?? 0.5),
      }));
    } finally {
      await session.close();
    }
  }

  async deleteByDocumentId(documentId: string, tenantId?: string, libraryId?: string): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      const tenantFilter = tenantId ? ' AND d.tenantId = $tenantId' : '';
      const libraryFilter = libraryId ? ' AND d.libraryId = $libraryId' : '';
      // Use Document->Entity MENTIONS relationship for reliable deletion
      // instead of string matching on entityId
      await session.run(
        `
        MATCH (d:Document {documentId: $documentId})-[:MENTIONS]->(e:Entity)
        WHERE 1=1${tenantFilter}${libraryFilter}
        MATCH (e)-[r:RELATED]-(other)
        DELETE r
        `,
        { documentId, tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
      await session.run(
        `
        MATCH (d:Document {documentId: $documentId})-[:MENTIONS]->(e:Entity)
        WHERE 1=1${tenantFilter}${libraryFilter}
        DETACH DELETE e
        `,
        { documentId, tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
    } finally {
      await session.close();
    }
  }

  async ensureVectorIndex(dimensions: number): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run('DROP INDEX chunk_embedding_index IF EXISTS');
      await session.run(
        `CREATE VECTOR INDEX chunk_embedding_index IF NOT EXISTS
         FOR (c:Chunk) ON (c.embedding)
         OPTIONS {indexConfig: {
           \`vector.dimensions\`: $dimensions,
           \`vector.similarity_function\`: 'cosine'
         }}`,
         { dimensions: int(dimensions) },
       );
    } finally {
      await session.close();
    }
  }

  async saveChunks(
    chunks: ChunkWithEmbedding[],
    tenantId?: string,
    libraryId?: string,
  ): Promise<void> {
    if (chunks.length === 0) return;

    const session = this.neo4j.getSession();
    try {
      for (const chunk of chunks) {
        await session.run(
          `
          MERGE (c:Chunk {chunkId: $chunkId})
          SET c.documentId = $documentId,
              c.tenantId   = $tenantId,
              c.libraryId  = $libraryId,
              c.seq        = $seq,
              c.text       = $text,
              c.embedding  = $embedding,
              c.embeddingModel = $embeddingModel,
              c.updatedAt  = $updatedAt
          WITH c
          MATCH (d:Document {documentId: $documentId})
          MERGE (d)-[:HAS_CHUNK]->(c)
          `,
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            tenantId: tenantId ?? chunk.tenantId ?? null,
            libraryId: libraryId ?? chunk.libraryId ?? null,
            seq: chunk.seq,
            text: chunk.text,
            embedding: chunk.embedding,
            embeddingModel: chunk.embeddingModel,
            updatedAt: new Date().toISOString(),
          },
        );
      }
    } finally {
      await session.close();
    }
  }

  async linkChunksToEntities(extractedGraph: ExtractedGraph): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      for (const entity of extractedGraph.entities) {
        const sourceChunkId = entity.attributes?.sourceChunkId as string | undefined;
        if (!sourceChunkId) continue;

        await session.run(
          `
          MATCH (c:Chunk {chunkId: $chunkId})
          MATCH (e:Entity {entityId: $entityId})
          MERGE (c)-[:MENTIONS]->(e)
          `,
          { chunkId: sourceChunkId, entityId: entity.entityId },
        );
      }
    } finally {
      await session.close();
    }
  }

  async deleteChunksByDocumentId(
    documentId: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      const tenantFilter = tenantId ? ' AND c.tenantId = $tenantId' : '';
      const libraryFilter = libraryId ? ' AND c.libraryId = $libraryId' : '';
      await session.run(
        `
        MATCH (c:Chunk {documentId: $documentId})
        WHERE 1=1${tenantFilter}${libraryFilter}
        DETACH DELETE c
        `,
        { documentId, tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
    } finally {
      await session.close();
    }
  }

  private normalizeLibraryIds(libraryIds?: string[]): string[] {
    return [...new Set((libraryIds ?? []).map((libraryId) => libraryId.trim()).filter(Boolean))];
  }
}
