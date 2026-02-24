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
exports.MongoDocumentRepository = void 0;
const common_1 = require("@nestjs/common");
const mongo_database_service_1 = require("./mongo-database.service");
const node_crypto_1 = require("node:crypto");
let MongoDocumentRepository = class MongoDocumentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createDocument(input) {
        const now = new Date().toISOString();
        const doc = {
            ...input,
            createdAt: now,
            updatedAt: now,
        };
        await this.db.documentsCollection.insertOne(doc);
        return doc;
    }
    async updateDocumentStatus(documentId, status, graphSyncStatus) {
        const now = new Date().toISOString();
        await this.db.documentsCollection.updateOne({ documentId }, {
            $set: {
                status,
                updatedAt: now,
                ...(graphSyncStatus ? { graphSyncStatus } : {}),
            },
        });
    }
    async addChunks(chunks) {
        if (chunks.length === 0) {
            return;
        }
        await this.db.chunksCollection.insertMany(chunks);
    }
    async listAllChunks(limit = 10000) {
        return (await this.db.chunksCollection
            .find({})
            .limit(limit)
            .toArray());
    }
    async listChunksNeedingReindex(currentEmbeddingModel, limit = 10000) {
        return (await this.db.chunksCollection
            .find({
            $or: [
                { embeddingModel: { $exists: false } },
                { embeddingModel: null },
                { embeddingModel: { $ne: currentEmbeddingModel } },
            ],
        })
            .limit(limit)
            .toArray());
    }
    async updateChunkEmbedding(chunkId, embedding, embeddingModel) {
        await this.db.chunksCollection.updateOne({ chunkId }, { $set: { embedding, embeddingModel } });
    }
    async listDocuments(limit = 50) {
        return (await this.db.documentsCollection
            .find({})
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray());
    }
    async findDocumentById(documentId) {
        return (await this.db.documentsCollection.findOne({ documentId }));
    }
    async enqueueGraphSyncEvent(documentId, graph) {
        const now = new Date().toISOString();
        const event = {
            eventId: (0, node_crypto_1.randomUUID)(),
            documentId,
            payload: JSON.stringify(graph),
            status: 'PENDING',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
        };
        await this.db.graphSyncOutboxCollection.insertOne(event);
        return event;
    }
    async getRetryableGraphSyncEvents(limit) {
        return (await this.db.graphSyncOutboxCollection
            .find({ status: { $in: ['PENDING', 'FAILED'] }, attempts: { $lt: 10 } })
            .sort({ updatedAt: 1 })
            .limit(limit)
            .toArray());
    }
    async markGraphSyncEvent(eventId, status, details) {
        const now = new Date().toISOString();
        await this.db.graphSyncOutboxCollection.updateOne({ eventId }, {
            $set: {
                status,
                updatedAt: now,
                ...(details?.attempts !== undefined ? { attempts: details.attempts } : {}),
                ...(details?.lastError !== undefined ? { lastError: details.lastError } : {}),
            },
        });
    }
    async deleteDocument(documentId) {
        await this.db.chunksCollection.deleteMany({ documentId });
        await this.db.graphSyncOutboxCollection.deleteMany({ documentId });
        await this.db.documentsCollection.deleteOne({ documentId });
    }
};
exports.MongoDocumentRepository = MongoDocumentRepository;
exports.MongoDocumentRepository = MongoDocumentRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_database_service_1.MongoDatabaseService])
], MongoDocumentRepository);
//# sourceMappingURL=mongo-document.repository.js.map