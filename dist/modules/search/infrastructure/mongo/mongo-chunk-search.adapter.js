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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoChunkSearchAdapter = void 0;
const common_1 = require("@nestjs/common");
const mongo_database_service_1 = require("../../../documents/infrastructure/mongo/mongo-database.service");
const di_tokens_1 = require("../../../../shared/di.tokens");
let MongoChunkSearchAdapter = class MongoChunkSearchAdapter {
    db;
    embeddingPort;
    constructor(db, embeddingPort) {
        this.db = db;
        this.embeddingPort = embeddingPort;
    }
    async hybridSearch(query) {
        const queryVector = await this.embeddingPort.embed(query.queryText);
        const queryDim = queryVector.length;
        const candidateChunks = (await this.db.chunksCollection
            .find({})
            .limit(Math.max(query.topK * 8, 200))
            .toArray());
        const scored = candidateChunks.map((chunk) => {
            const embedding = chunk.embedding;
            const hasValidVector = Array.isArray(embedding) &&
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
    cosineSimilarity(a, b) {
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
    textOverlapScore(query, text) {
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
};
exports.MongoChunkSearchAdapter = MongoChunkSearchAdapter;
exports.MongoChunkSearchAdapter = MongoChunkSearchAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(di_tokens_1.EMBEDDING_PORT)),
    __metadata("design:paramtypes", [mongo_database_service_1.MongoDatabaseService, Object])
], MongoChunkSearchAdapter);
//# sourceMappingURL=mongo-chunk-search.adapter.js.map