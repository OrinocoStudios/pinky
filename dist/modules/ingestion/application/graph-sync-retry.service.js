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
exports.GraphSyncRetryService = void 0;
const common_1 = require("@nestjs/common");
const di_tokens_1 = require("../../../shared/di.tokens");
let GraphSyncRetryService = class GraphSyncRetryService {
    documentRepository;
    graphStore;
    intervalId;
    constructor(documentRepository, graphStore) {
        this.documentRepository = documentRepository;
        this.graphStore = graphStore;
    }
    onModuleInit() {
        this.intervalId = setInterval(() => {
            void this.retry(20);
        }, 30_000);
    }
    onModuleDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
    async retry(limit) {
        const events = await this.documentRepository.getRetryableGraphSyncEvents(limit);
        let synced = 0;
        let failed = 0;
        for (const event of events) {
            try {
                const graph = JSON.parse(event.payload);
                await this.graphStore.upsertGraph(graph);
                await this.documentRepository.markGraphSyncEvent(event.eventId, 'SYNCED', {
                    attempts: event.attempts + 1,
                    lastError: '',
                });
                await this.documentRepository.updateDocumentStatus(event.documentId, 'READY', 'SYNCED');
                synced++;
            }
            catch (error) {
                await this.documentRepository.markGraphSyncEvent(event.eventId, 'FAILED', {
                    attempts: event.attempts + 1,
                    lastError: error instanceof Error ? error.message : 'Unknown graph sync error',
                });
                failed++;
            }
        }
        return { processed: events.length, synced, failed };
    }
};
exports.GraphSyncRetryService = GraphSyncRetryService;
exports.GraphSyncRetryService = GraphSyncRetryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], GraphSyncRetryService);
//# sourceMappingURL=graph-sync-retry.service.js.map