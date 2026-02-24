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
var GraphSyncRetryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphSyncRetryService = void 0;
const common_1 = require("@nestjs/common");
const di_tokens_1 = require("../../../shared/di.tokens");
let GraphSyncRetryService = GraphSyncRetryService_1 = class GraphSyncRetryService {
    documentRepository;
    graphStore;
    logger = new common_1.Logger(GraphSyncRetryService_1.name);
    intervalId;
    constructor(documentRepository, graphStore) {
        this.documentRepository = documentRepository;
        this.graphStore = graphStore;
    }
    onModuleInit() {
        this.intervalId = setInterval(() => {
            void this.retry(20).catch((err) => {
                this.logger.error(`Retry cycle failed: ${err instanceof Error ? err.message : String(err)}`);
            });
        }, 30_000);
    }
    onModuleDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
    async retry(limit) {
        let synced = 0;
        let failed = 0;
        let processed = 0;
        for (let i = 0; i < limit; i++) {
            const event = await this.documentRepository.claimAndGetNextRetryableEvent();
            if (!event)
                break;
            try {
                const graph = JSON.parse(event.payload);
                await this.graphStore.upsertGraph(graph);
                await this.documentRepository.updateDocumentStatus(event.documentId, 'READY', 'SYNCED');
                await this.documentRepository.markGraphSyncEvent(event.eventId, 'SYNCED', {
                    lastError: '',
                });
                synced++;
            }
            catch (error) {
                const lastError = error instanceof Error ? error.message : 'Unknown graph sync error';
                const finalStatus = event.attempts >= 10 ? 'DEAD_LETTER' : 'FAILED';
                if (finalStatus === 'DEAD_LETTER') {
                    this.logger.warn(`Outbox event ${event.eventId} (documentId=${event.documentId}) moved to DEAD_LETTER after ${event.attempts} attempts. Last error: ${lastError}`);
                }
                try {
                    await this.documentRepository.markGraphSyncEvent(event.eventId, finalStatus, {
                        lastError,
                    });
                }
                catch (markError) {
                    this.logger.error(`Failed to mark event ${event.eventId} as ${finalStatus}: ${markError instanceof Error ? markError.message : String(markError)}`);
                }
                failed++;
            }
            processed++;
        }
        return { processed, synced, failed };
    }
};
exports.GraphSyncRetryService = GraphSyncRetryService;
exports.GraphSyncRetryService = GraphSyncRetryService = GraphSyncRetryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], GraphSyncRetryService);
//# sourceMappingURL=graph-sync-retry.service.js.map