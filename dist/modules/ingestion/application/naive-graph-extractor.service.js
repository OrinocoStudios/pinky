"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaiveGraphExtractorService = void 0;
const common_1 = require("@nestjs/common");
let NaiveGraphExtractorService = class NaiveGraphExtractorService {
    extract(documentId, text) {
        const entityPattern = /\b([A-Z][a-zA-Z]{2,})\b/g;
        const matches = Array.from(text.matchAll(entityPattern)).map((m) => m[1]);
        const uniqueNames = [...new Set(matches)].slice(0, 30);
        const entities = uniqueNames.map((name) => ({
            entityId: `${name.toLowerCase()}::${documentId}`,
            type: 'NamedEntity',
            name,
            normalized: name.toLowerCase(),
            attributes: { sourceDocumentId: documentId },
        }));
        const relationships = [];
        for (let i = 0; i < entities.length - 1; i++) {
            relationships.push({
                fromEntityId: entities[i].entityId,
                toEntityId: entities[i + 1].entityId,
                type: 'RELATED_TO',
                confidence: 0.5,
                sourceChunkId: 'document-level',
            });
        }
        return {
            sourceDocumentId: documentId,
            entities,
            relationships,
        };
    }
};
exports.NaiveGraphExtractorService = NaiveGraphExtractorService;
exports.NaiveGraphExtractorService = NaiveGraphExtractorService = __decorate([
    (0, common_1.Injectable)()
], NaiveGraphExtractorService);
//# sourceMappingURL=naive-graph-extractor.service.js.map