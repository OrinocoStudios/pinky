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
exports.GenerateDocumentDto = exports.UploadDocumentDto = exports.IngestTextDocumentDto = exports.DocumentSourceGeneratedDto = exports.DocumentSourceUrlDto = exports.DocumentSourceUploadDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class DocumentSourceBaseDto {
    kind;
}
__decorate([
    (0, class_validator_1.IsIn)(['upload', 'url', 'generated']),
    __metadata("design:type", String)
], DocumentSourceBaseDto.prototype, "kind", void 0);
class DocumentSourceUploadDto extends DocumentSourceBaseDto {
    filename;
    mimeType;
}
exports.DocumentSourceUploadDto = DocumentSourceUploadDto;
__decorate([
    (0, class_validator_1.IsIn)(['upload']),
    __metadata("design:type", String)
], DocumentSourceUploadDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DocumentSourceUploadDto.prototype, "filename", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DocumentSourceUploadDto.prototype, "mimeType", void 0);
class DocumentSourceUrlDto extends DocumentSourceBaseDto {
    url;
}
exports.DocumentSourceUrlDto = DocumentSourceUrlDto;
__decorate([
    (0, class_validator_1.IsIn)(['url']),
    __metadata("design:type", String)
], DocumentSourceUrlDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DocumentSourceUrlDto.prototype, "url", void 0);
class DocumentSourceGeneratedDto extends DocumentSourceBaseDto {
    useCaseId;
}
exports.DocumentSourceGeneratedDto = DocumentSourceGeneratedDto;
__decorate([
    (0, class_validator_1.IsIn)(['generated']),
    __metadata("design:type", String)
], DocumentSourceGeneratedDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DocumentSourceGeneratedDto.prototype, "useCaseId", void 0);
class IngestTextDocumentDto {
    title;
    rawText;
    source;
    metadata;
}
exports.IngestTextDocumentDto = IngestTextDocumentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestTextDocumentDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], IngestTextDocumentDto.prototype, "rawText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.source != null),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DocumentSourceBaseDto, {
        keepDiscriminatorProperty: true,
        discriminator: {
            property: 'kind',
            subTypes: [
                { value: DocumentSourceUploadDto, name: 'upload' },
                { value: DocumentSourceUrlDto, name: 'url' },
                { value: DocumentSourceGeneratedDto, name: 'generated' },
            ],
        },
    }),
    __metadata("design:type", Object)
], IngestTextDocumentDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], IngestTextDocumentDto.prototype, "metadata", void 0);
class UploadDocumentDto {
    title;
    metadata;
}
exports.UploadDocumentDto = UploadDocumentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UploadDocumentDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UploadDocumentDto.prototype, "metadata", void 0);
class GenerateDocumentDto {
    useCaseId;
    title;
    params;
}
exports.GenerateDocumentDto = GenerateDocumentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateDocumentDto.prototype, "useCaseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateDocumentDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], GenerateDocumentDto.prototype, "params", void 0);
//# sourceMappingURL=documents.dto.js.map