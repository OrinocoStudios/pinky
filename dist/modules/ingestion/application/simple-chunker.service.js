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
exports.SimpleChunkerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
let SimpleChunkerService = class SimpleChunkerService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    chunk(documentId, text) {
        const chunkSize = this.configService.get('app.chunkSize', { infer: true }) ?? 1200;
        const chunkOverlap = this.configService.get('app.chunkOverlap', { infer: true }) ?? 200;
        const safeOverlap = Math.max(0, Math.min(chunkOverlap, Math.floor(chunkSize / 2)));
        const step = Math.max(1, chunkSize - safeOverlap);
        const chunks = [];
        const createdAt = new Date().toISOString();
        let seq = 0;
        for (let i = 0; i < text.length; i += step) {
            const end = Math.min(i + chunkSize, text.length);
            const slice = text.slice(i, end).trim();
            if (!slice) {
                continue;
            }
            chunks.push({
                chunkId: (0, node_crypto_1.randomUUID)(),
                documentId,
                seq: seq++,
                text: slice,
                startOffset: i,
                endOffset: end,
                createdAt,
            });
            if (end >= text.length) {
                break;
            }
        }
        return chunks;
    }
};
exports.SimpleChunkerService = SimpleChunkerService;
exports.SimpleChunkerService = SimpleChunkerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SimpleChunkerService);
//# sourceMappingURL=simple-chunker.service.js.map