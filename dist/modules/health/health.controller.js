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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongo_database_service_1 = require("../documents/infrastructure/mongo/mongo-database.service");
const di_tokens_1 = require("../../shared/di.tokens");
let HealthController = class HealthController {
    mongoDb;
    graphStore;
    configService;
    constructor(mongoDb, graphStore, configService) {
        this.mongoDb = mongoDb;
        this.graphStore = graphStore;
        this.configService = configService;
    }
    async health() {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();
        const uptime = Math.floor(process.uptime());
        const services = {};
        try {
            const mongoLatency = await this.mongoDb.ping();
            services.mongodb = { status: 'up', latency_ms: mongoLatency };
        }
        catch {
            services.mongodb = { status: 'down' };
        }
        try {
            const neoStart = Date.now();
            await this.graphStore.ping();
            services.neo4j = { status: 'up', latency_ms: Date.now() - neoStart };
        }
        catch {
            services.neo4j = { status: 'down' };
        }
        const llmProvider = this.configService.get('llm.provider', { infer: true });
        services.llm = {
            status: llmProvider ? 'configured' : 'unknown',
            provider: llmProvider ?? 'none',
        };
        const allUp = services.mongodb?.status === 'up' && services.neo4j?.status === 'up';
        const status = allUp ? 'ok' : 'degraded';
        return {
            status,
            timestamp,
            uptime,
            services,
            service: 'brain-service',
            latency_ms: Date.now() - startTime,
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "health", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)(),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __metadata("design:paramtypes", [mongo_database_service_1.MongoDatabaseService, Object, config_1.ConfigService])
], HealthController);
//# sourceMappingURL=health.controller.js.map