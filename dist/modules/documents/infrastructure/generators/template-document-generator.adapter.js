"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateDocumentGeneratorAdapter = void 0;
const common_1 = require("@nestjs/common");
let TemplateDocumentGeneratorAdapter = class TemplateDocumentGeneratorAdapter {
    templates = new Map([
        ['sample', (p) => `Documento de ejemplo generado.\nParámetros: ${JSON.stringify(p ?? {})}`],
        ['manual-api-text', () => 'Documento creado vía API manual.'],
        ['placeholder', (p) => `Placeholder para caso de uso.\nTítulo: ${String(p?.title ?? 'Sin título')}`],
    ]);
    async generate(useCaseId, params) {
        const template = this.templates.get(useCaseId);
        if (template) {
            return template(params ?? {});
        }
        return `Documento generado para caso de uso "${useCaseId}".\nParámetros: ${JSON.stringify(params ?? {})}`;
    }
};
exports.TemplateDocumentGeneratorAdapter = TemplateDocumentGeneratorAdapter;
exports.TemplateDocumentGeneratorAdapter = TemplateDocumentGeneratorAdapter = __decorate([
    (0, common_1.Injectable)()
], TemplateDocumentGeneratorAdapter);
//# sourceMappingURL=template-document-generator.adapter.js.map