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
exports.GenerateDocumentUseCase = void 0;
const common_1 = require("@nestjs/common");
const di_tokens_1 = require("../../../shared/di.tokens");
const ingest_document_usecase_1 = require("../../ingestion/application/ingest-document.usecase");
let GenerateDocumentUseCase = class GenerateDocumentUseCase {
    documentGenerator;
    ingestDocumentUseCase;
    constructor(documentGenerator, ingestDocumentUseCase) {
        this.documentGenerator = documentGenerator;
        this.ingestDocumentUseCase = ingestDocumentUseCase;
    }
    async execute(input) {
        const rawText = await this.documentGenerator.generate(input.useCaseId, input.params);
        return this.ingestDocumentUseCase.execute({
            title: input.title ?? `Generated: ${input.useCaseId}`,
            rawText,
            source: { kind: 'generated', useCaseId: input.useCaseId },
            metadata: { params: input.params },
        });
    }
};
exports.GenerateDocumentUseCase = GenerateDocumentUseCase;
exports.GenerateDocumentUseCase = GenerateDocumentUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_GENERATOR_PORT)),
    __metadata("design:paramtypes", [Object, ingest_document_usecase_1.IngestDocumentUseCase])
], GenerateDocumentUseCase);
//# sourceMappingURL=generate-document.usecase.js.map