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
exports.DocumentsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const ingest_document_usecase_1 = require("../../ingestion/application/ingest-document.usecase");
const delete_document_usecase_1 = require("../application/delete-document.usecase");
const generate_document_usecase_1 = require("../application/generate-document.usecase");
const di_tokens_1 = require("../../../shared/di.tokens");
const documents_dto_1 = require("./documents.dto");
const require_api_key_decorator_1 = require("../../../common/decorators/require-api-key.decorator");
const file_upload_interceptor_1 = require("../../../common/interceptors/file-upload.interceptor");
let DocumentsController = class DocumentsController {
    ingestDocumentUseCase;
    deleteDocumentUseCase;
    generateDocumentUseCase;
    documentRepository;
    fileTextExtractor;
    constructor(ingestDocumentUseCase, deleteDocumentUseCase, generateDocumentUseCase, documentRepository, fileTextExtractor) {
        this.ingestDocumentUseCase = ingestDocumentUseCase;
        this.deleteDocumentUseCase = deleteDocumentUseCase;
        this.generateDocumentUseCase = generateDocumentUseCase;
        this.documentRepository = documentRepository;
        this.fileTextExtractor = fileTextExtractor;
    }
    async ingestText(body) {
        return this.ingestDocumentUseCase.execute({
            title: body.title,
            rawText: body.rawText,
            source: body.source ?? { kind: 'generated', useCaseId: 'manual-api-text' },
            metadata: body.metadata,
        });
    }
    async generateDocument(body) {
        if (!body.useCaseId?.trim()) {
            throw new common_1.BadRequestException('useCaseId is required');
        }
        return this.generateDocumentUseCase.execute({
            useCaseId: body.useCaseId,
            title: body.title,
            params: body.params,
        });
    }
    async uploadDocument(file, body) {
        if (!file) {
            throw new common_1.BadRequestException('file is required');
        }
        const extracted = await this.fileTextExtractor.extract(file);
        if (!extracted.trim()) {
            throw new common_1.BadRequestException('Unable to extract text from uploaded file');
        }
        return this.ingestDocumentUseCase.execute({
            title: body.title ?? file.originalname ?? 'uploaded-file',
            rawText: extracted,
            source: {
                kind: 'upload',
                filename: file.originalname ?? 'uploaded-file',
                mimeType: file.mimetype ?? 'application/octet-stream',
            },
            metadata: {
                ...(body.metadata ?? {}),
                size: file.size,
            },
        });
    }
    async listDocuments() {
        return this.documentRepository.listDocuments(100);
    }
    async deleteDocument(documentId) {
        await this.deleteDocumentUseCase.execute(documentId);
        return { deleted: documentId };
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Post)('text'),
    (0, require_api_key_decorator_1.RequireApiKey)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [documents_dto_1.IngestTextDocumentDto]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "ingestText", null);
__decorate([
    (0, common_1.Post)('generate'),
    (0, require_api_key_decorator_1.RequireApiKey)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [documents_dto_1.GenerateDocumentDto]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "generateDocument", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, throttler_1.Throttle)({ upload: {} }),
    (0, require_api_key_decorator_1.RequireApiKey)(),
    (0, common_1.UseInterceptors)(file_upload_interceptor_1.FileUploadInterceptor),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, documents_dto_1.UploadDocumentDto]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "listDocuments", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_api_key_decorator_1.RequireApiKey)(),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "deleteDocument", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.Controller)('documents'),
    __param(3, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(4, (0, common_1.Inject)(di_tokens_1.FILE_TEXT_EXTRACTOR_PORT)),
    __metadata("design:paramtypes", [ingest_document_usecase_1.IngestDocumentUseCase,
        delete_document_usecase_1.DeleteDocumentUseCase,
        generate_document_usecase_1.GenerateDocumentUseCase, Object, Object])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map