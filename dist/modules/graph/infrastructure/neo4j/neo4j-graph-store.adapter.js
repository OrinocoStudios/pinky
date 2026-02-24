"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jGraphStoreAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const neo4j_driver_1 = require("neo4j-driver");
let Neo4jGraphStoreAdapter = class Neo4jGraphStoreAdapter {
    configService;
    driver;
    constructor(configService) {
        this.configService = configService;
        const uri = this.configService.get('neo4j.uri', { infer: true });
        const user = this.configService.get('neo4j.user', { infer: true });
        const password = this.configService.get('neo4j.password', { infer: true });
        if (!uri || !user || !password) {
            throw new Error('Neo4j config is missing');
        }
        this.driver = (0, neo4j_driver_1.driver)(uri, neo4j_driver_1.auth.basic(user, password));
    }
    async upsertGraph(graph) {
        const session = this.createSession();
        try {
            const now = new Date().toISOString();
            if (graph.sourceDocumentId) {
                await session.run(`
          MERGE (d:Document {documentId: $documentId})
          SET d.updatedAt = $updatedAt
          `, { documentId: graph.sourceDocumentId, updatedAt: now });
            }
            for (const entity of graph.entities) {
                await session.run(`
          MERGE (e:Entity {entityId: $entityId})
          SET e.name = $name,
              e.type = $type,
              e.normalized = $normalized,
              e.updatedAt = $updatedAt
          `, {
                    entityId: entity.entityId,
                    name: entity.name,
                    type: entity.type,
                    normalized: entity.normalized ?? entity.name.toLowerCase(),
                    updatedAt: now,
                });
                if (graph.sourceDocumentId) {
                    await session.run(`
            MATCH (d:Document {documentId: $documentId})
            MATCH (e:Entity {entityId: $entityId})
            MERGE (d)-[:MENTIONS]->(e)
            `, { documentId: graph.sourceDocumentId, entityId: entity.entityId });
                }
            }
            for (const relation of graph.relationships) {
                await session.run(`
          MATCH (a:Entity {entityId: $fromEntityId})
          MATCH (b:Entity {entityId: $toEntityId})
          MERGE (a)-[r:RELATED {type: $type, sourceChunkId: $sourceChunkId}]->(b)
          SET r.confidence = $confidence,
              r.updatedAt = $updatedAt
          `, {
                    fromEntityId: relation.fromEntityId,
                    toEntityId: relation.toEntityId,
                    type: relation.type,
                    sourceChunkId: relation.sourceChunkId,
                    confidence: relation.confidence,
                    updatedAt: now,
                });
            }
        }
        finally {
            await session.close();
        }
    }
    async findEntitiesByNames(names) {
        if (names.length === 0) {
            return [];
        }
        const session = this.createSession();
        try {
            const result = await session.run(`
        MATCH (e:Entity)
        WHERE toLower(e.name) IN $names
        RETURN e.entityId AS entityId, e.type AS type, e.name AS name, e.normalized AS normalized
        LIMIT 50
        `, { names: names.map((name) => name.toLowerCase()) });
            return result.records.map((record) => ({
                entityId: record.get('entityId'),
                type: record.get('type'),
                name: record.get('name'),
                normalized: record.get('normalized') ?? undefined,
            }));
        }
        finally {
            await session.close();
        }
    }
    async findRelationshipsForEntityIds(entityIds) {
        if (entityIds.length === 0) {
            return [];
        }
        const session = this.createSession();
        try {
            const result = await session.run(`
        MATCH (a:Entity)-[r:RELATED]->(b:Entity)
        WHERE a.entityId IN $entityIds OR b.entityId IN $entityIds
        RETURN a.entityId AS fromEntityId,
               b.entityId AS toEntityId,
               r.type AS type,
               r.sourceChunkId AS sourceChunkId,
               r.confidence AS confidence
        LIMIT 100
        `, { entityIds });
            return result.records.map((record) => ({
                fromEntityId: record.get('fromEntityId'),
                toEntityId: record.get('toEntityId'),
                type: record.get('type'),
                sourceChunkId: record.get('sourceChunkId') ?? 'unknown',
                confidence: Number(record.get('confidence') ?? 0.5),
            }));
        }
        finally {
            await session.close();
        }
    }
    async deleteByDocumentId(documentId) {
        const session = this.createSession();
        const entityPattern = `::${documentId}::`;
        try {
            await session.run(`
        MATCH (a:Entity)-[r:RELATED]-(b:Entity)
        WHERE a.entityId CONTAINS $pattern OR b.entityId CONTAINS $pattern
        DELETE r
        `, { pattern: entityPattern });
            await session.run(`
        MATCH (e:Entity)
        WHERE e.entityId CONTAINS $pattern
        DETACH DELETE e
        `, { pattern: entityPattern });
            await session.run(`
        MATCH (d:Document {documentId: $documentId})
        DETACH DELETE d
        `, { documentId });
        }
        finally {
            await session.close();
        }
    }
    createSession() {
        return this.driver.session();
    }
    async onModuleDestroy() {
        await this.driver.close();
    }
};
exports.Neo4jGraphStoreAdapter = Neo4jGraphStoreAdapter;
exports.Neo4jGraphStoreAdapter = Neo4jGraphStoreAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], Neo4jGraphStoreAdapter);
//# sourceMappingURL=neo4j-graph-store.adapter.js.map