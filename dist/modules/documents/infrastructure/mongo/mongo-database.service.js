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
exports.MongoDatabaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("mongoose");
let MongoDatabaseService = class MongoDatabaseService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async onModuleInit() {
        const uri = this.configService.get('mongo.uri', { infer: true });
        const dbName = this.configService.get('mongo.dbName', { infer: true });
        if (!uri || !dbName) {
            throw new Error('MongoDB config is missing');
        }
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(uri, { dbName });
        }
        await this.ensureIndexes();
    }
    async ensureIndexes() {
        const db = this.getDb();
        await db.collection('documents').createIndex({ documentId: 1 }, { unique: true });
        await db.collection('documents').createIndex({ checksum: 1 }, { sparse: true, unique: true });
        await db.collection('chunks').createIndex({ chunkId: 1 }, { unique: true });
        await db.collection('chunks').createIndex({ documentId: 1 });
        await db.collection('graph_sync_outbox').createIndex({ status: 1, attempts: 1, updatedAt: 1 });
        await db.collection('graph_sync_outbox').createIndex({ documentId: 1 });
    }
    async onModuleDestroy() {
        if (mongoose_1.default.connection.readyState !== 0) {
            await mongoose_1.default.disconnect();
        }
    }
    get documentsCollection() {
        return this.getDb().collection('documents');
    }
    get chunksCollection() {
        return this.getDb().collection('chunks');
    }
    get graphSyncOutboxCollection() {
        return this.getDb().collection('graph_sync_outbox');
    }
    async ping() {
        const start = Date.now();
        await this.getDb().command({ ping: 1 });
        return Date.now() - start;
    }
    getDb() {
        if (!mongoose_1.default.connection.db) {
            throw new Error('MongoDB connection is not initialized');
        }
        return mongoose_1.default.connection.db;
    }
};
exports.MongoDatabaseService = MongoDatabaseService;
exports.MongoDatabaseService = MongoDatabaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MongoDatabaseService);
//# sourceMappingURL=mongo-database.service.js.map