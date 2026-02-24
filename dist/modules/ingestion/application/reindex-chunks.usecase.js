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
exports.ReindexChunksUseCase = void 0;
const common_1 = require("@nestjs/common");
const di_tokens_1 = require("../../../shared/di.tokens");
let ReindexChunksUseCase = class ReindexChunksUseCase {
    documentRepository;
    embeddingPort;
    constructor(documentRepository, embeddingPort) {
        this.documentRepository = documentRepository;
        this.embeddingPort = embeddingPort;
    }
    async execute(input = {}) {
        const limit = input.limit ?? 10000;
        const mode = input.mode ?? 'rebuild';
        const embeddingModel = this.embeddingPort.getModelId();
        const chunks = mode === 'incremental'
            ? await this.documentRepository.listChunksNeedingReindex(embeddingModel, limit)
            : await this.documentRepository.listAllChunks(limit);
        let processed = 0;
        let failed = 0;
        for (const chunk of chunks) {
            try {
                const embedding = await this.embeddingPort.embed(chunk.text);
                await this.documentRepository.updateChunkEmbedding(chunk.chunkId, embedding, embeddingModel);
                processed++;
            }
            catch {
                failed++;
            }
        }
        return { processed, failed, embeddingModel };
    }
};
exports.ReindexChunksUseCase = ReindexChunksUseCase;
exports.ReindexChunksUseCase = ReindexChunksUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(di_tokens_1.EMBEDDING_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], ReindexChunksUseCase);
//# sourceMappingURL=reindex-chunks.usecase.js.map