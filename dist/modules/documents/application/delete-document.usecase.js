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
exports.DeleteDocumentUseCase = void 0;
const common_1 = require("@nestjs/common");
const di_tokens_1 = require("../../../shared/di.tokens");
let DeleteDocumentUseCase = class DeleteDocumentUseCase {
    documentRepository;
    graphStore;
    constructor(documentRepository, graphStore) {
        this.documentRepository = documentRepository;
        this.graphStore = graphStore;
    }
    async execute(documentId) {
        const doc = await this.documentRepository.findDocumentById(documentId);
        if (!doc) {
            throw new common_1.NotFoundException(`Document ${documentId} not found`);
        }
        await this.graphStore.deleteByDocumentId(documentId);
        await this.documentRepository.deleteDocument(documentId);
    }
};
exports.DeleteDocumentUseCase = DeleteDocumentUseCase;
exports.DeleteDocumentUseCase = DeleteDocumentUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], DeleteDocumentUseCase);
//# sourceMappingURL=delete-document.usecase.js.map