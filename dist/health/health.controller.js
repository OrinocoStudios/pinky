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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const neo4j_graph_store_adapter_1 = require("../modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter");
const mongo_database_service_1 = require("../modules/documents/infrastructure/mongo/mongo-database.service");
const config_1 = require("@nestjs/config");
let HealthController = class HealthController {
    mongo;
    neo4j;
    configService;
    constructor(mongo, neo4j, configService) {
        this.mongo = mongo;
        this.neo4j = neo4j;
        this.configService = configService;
    }
    async check() {
        const llmProvider = this.configService.get('llm.provider', { infer: true }) ?? 'local';
        let mongoStatus = 'down';
        let neo4jStatus = 'down';
        try {
            await this.mongo.ping();
            mongoStatus = 'up';
        }
        catch {
            mongoStatus = 'down';
        }
        try {
            await this.neo4j.ping();
            neo4jStatus = 'up';
        }
        catch {
            neo4jStatus = 'down';
        }
        return {
            status: mongoStatus === 'up' && neo4jStatus === 'up' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: 'brain-service',
            version: '0.2.0',
            services: {
                mongodb: { status: mongoStatus },
                neo4j: { status: neo4jStatus },
                llm: { provider: llmProvider, status: 'configured' },
            },
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [mongo_database_service_1.MongoDatabaseService,
        neo4j_graph_store_adapter_1.Neo4jGraphStoreAdapter,
        config_1.ConfigService])
], HealthController);
//# sourceMappingURL=health.controller.js.map