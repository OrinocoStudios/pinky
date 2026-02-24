import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Driver, Session, auth, driver as neo4jDriver } from 'neo4j-driver';
import { GraphStorePort } from '../../domain/ports/graph-store.port';
import { ExtractedGraph, GraphEntity, GraphRelationship } from '../../domain/models/graph.model';
import { BrainConfig } from '../../../../config/configuration';

@Injectable()
export class Neo4jGraphStoreAdapter implements GraphStorePort, OnModuleDestroy {
  private readonly driver: Driver;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const uri = this.configService.get<string>('neo4j.uri', { infer: true });
    const user = this.configService.get<string>('neo4j.user', { infer: true });
    const password = this.configService.get<string>('neo4j.password', { infer: true });

    if (!uri || !user || !password) {
      throw new Error('Neo4j config is missing');
    }

    this.driver = neo4jDriver(uri, auth.basic(user, password));
  }

  async upsertGraph(graph: ExtractedGraph): Promise<void> {
    const session = this.createSession();
    try {
      const now = new Date().toISOString();
      if (graph.sourceDocumentId) {
        await session.run(
          `
          MERGE (d:Document {documentId: $documentId})
          SET d.updatedAt = $updatedAt
          `,
          { documentId: graph.sourceDocumentId, updatedAt: now },
        );
      }

      for (const entity of graph.entities) {
        await session.run(
          `
          MERGE (e:Entity {entityId: $entityId})
          SET e.name = $name,
              e.type = $type,
              e.normalized = $normalized,
              e.updatedAt = $updatedAt
          `,
          {
            entityId: entity.entityId,
            name: entity.name,
            type: entity.type,
            normalized: entity.normalized ?? entity.name.toLowerCase(),
            updatedAt: now,
          },
        );

        if (graph.sourceDocumentId) {
          await session.run(
            `
            MATCH (d:Document {documentId: $documentId})
            MATCH (e:Entity {entityId: $entityId})
            MERGE (d)-[:MENTIONS]->(e)
            `,
            { documentId: graph.sourceDocumentId, entityId: entity.entityId },
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
              r.updatedAt = $updatedAt
          `,
          {
            fromEntityId: relation.fromEntityId,
            toEntityId: relation.toEntityId,
            type: relation.type,
            sourceChunkId: relation.sourceChunkId,
            confidence: relation.confidence,
            updatedAt: now,
          },
        );
      }
    } finally {
      await session.close();
    }
  }

  async findEntitiesByNames(names: string[]): Promise<GraphEntity[]> {
    if (names.length === 0) {
      return [];
    }

    const session = this.createSession();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity)
        WHERE toLower(e.name) IN $names
        RETURN e.entityId AS entityId, e.type AS type, e.name AS name, e.normalized AS normalized
        LIMIT 50
        `,
        { names: names.map((name) => name.toLowerCase()) },
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

  async findRelationshipsForEntityIds(entityIds: string[]): Promise<GraphRelationship[]> {
    if (entityIds.length === 0) {
      return [];
    }

    const session = this.createSession();
    try {
      const result = await session.run(
        `
        MATCH (a:Entity)-[r:RELATED]->(b:Entity)
        WHERE a.entityId IN $entityIds OR b.entityId IN $entityIds
        RETURN a.entityId AS fromEntityId,
               b.entityId AS toEntityId,
               r.type AS type,
               r.sourceChunkId AS sourceChunkId,
               r.confidence AS confidence
        LIMIT 100
        `,
        { entityIds },
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

  async deleteByDocumentId(documentId: string): Promise<void> {
    const session = this.createSession();
    const entityPattern = `::${documentId}::`;
    try {
      await session.run(
        `
        MATCH (a:Entity)-[r:RELATED]-(b:Entity)
        WHERE a.entityId CONTAINS $pattern OR b.entityId CONTAINS $pattern
        DELETE r
        `,
        { pattern: entityPattern },
      );
      await session.run(
        `
        MATCH (e:Entity)
        WHERE e.entityId CONTAINS $pattern
        DETACH DELETE e
        `,
        { pattern: entityPattern },
      );
      await session.run(
        `
        MATCH (d:Document {documentId: $documentId})
        DETACH DELETE d
        `,
        { documentId },
      );
    } finally {
      await session.close();
    }
  }

  private createSession(): Session {
    return this.driver.session();
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
