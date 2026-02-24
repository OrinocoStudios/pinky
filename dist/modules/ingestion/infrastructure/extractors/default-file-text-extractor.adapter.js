"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultFileTextExtractorAdapter = void 0;
const common_1 = require("@nestjs/common");
let DefaultFileTextExtractorAdapter = class DefaultFileTextExtractorAdapter {
    async extract(file) {
        if (!file.buffer) {
            return '';
        }
        const mimetype = (file.mimetype ?? '').toLowerCase();
        const name = (file.originalname ?? '').toLowerCase();
        if (mimetype.includes('application/pdf') || name.endsWith('.pdf')) {
            return this.extractPdf(file.buffer);
        }
        if (mimetype.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
            name.endsWith('.docx')) {
            return this.extractDocx(file.buffer);
        }
        return file.buffer.toString('utf-8');
    }
    async extractPdf(buffer) {
        const pdfParseModule = await Promise.resolve().then(() => require('pdf-parse'));
        const pdfParse = pdfParseModule.default ??
            pdfParseModule;
        const parsed = await pdfParse(buffer);
        return parsed.text ?? '';
    }
    async extractDocx(buffer) {
        const mammothModule = await Promise.resolve().then(() => require('mammoth'));
        const mammoth = mammothModule.default ??
            mammothModule;
        const result = await mammoth.extractRawText({ buffer });
        return result.value ?? '';
    }
};
exports.DefaultFileTextExtractorAdapter = DefaultFileTextExtractorAdapter;
exports.DefaultFileTextExtractorAdapter = DefaultFileTextExtractorAdapter = __decorate([
    (0, common_1.Injectable)()
], DefaultFileTextExtractorAdapter);
//# sourceMappingURL=default-file-text-extractor.adapter.js.map