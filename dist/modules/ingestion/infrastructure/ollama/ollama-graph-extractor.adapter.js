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
exports.OllamaGraphExtractorAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let OllamaGraphExtractorAdapter = class OllamaGraphExtractorAdapter {
    configService;
    baseUrl;
    model;
    timeoutMs;
    constructor(configService) {
        this.configService = configService;
        const ollama = configService.get('ollama', { infer: true });
        this.baseUrl = ollama?.baseUrl ?? 'http://localhost:11434';
        this.model = ollama?.extractionModel ?? 'llama3.2';
        this.timeoutMs = ollama?.timeoutMs ?? 60000;
    }
    async extract(documentId, chunks) {
        const allEntities = [];
        const allRelationships = [];
        const entityIdMap = new Map();
        for (const chunk of chunks) {
            const extracted = await this.extractFromChunk(documentId, chunk);
            const chunkEntityIds = new Map();
            for (const e of extracted.entities) {
                const key = `${e.normalized ?? e.name.toLowerCase()}::${chunk.chunkId}`;
                const entityId = `${e.normalized ?? e.name.toLowerCase()}::${documentId}::${chunk.chunkId}`;
                chunkEntityIds.set(e.name, entityId);
                entityIdMap.set(key, entityId);
                allEntities.push({
                    entityId,
                    type: e.type || 'NamedEntity',
                    name: e.name,
                    normalized: e.normalized ?? e.name.toLowerCase(),
                    attributes: { sourceDocumentId: documentId, sourceChunkId: chunk.chunkId },
                });
            }
            for (const r of extracted.relationships) {
                const fromId = chunkEntityIds.get(r.from) ?? this.makeEntityId(r.from, documentId, chunk.chunkId);
                const toId = chunkEntityIds.get(r.to) ?? this.makeEntityId(r.to, documentId, chunk.chunkId);
                allRelationships.push({
                    fromEntityId: fromId,
                    toEntityId: toId,
                    type: r.type || 'RELATED_TO',
                    confidence: Math.min(1, Math.max(0, r.confidence ?? 0.5)),
                    sourceChunkId: chunk.chunkId,
                });
            }
        }
        return {
            sourceDocumentId: documentId,
            entities: this.deduplicateEntities(allEntities),
            relationships: allRelationships,
        };
    }
    getModelId() {
        return this.model;
    }
    async extractFromChunk(documentId, chunk) {
        const schema = `{
  "entities": [{"name": "string", "type": "string", "normalized": "string"}],
  "relationships": [{"from": "entity name", "to": "entity name", "type": "string", "confidence": 0.0-1.0}]
}`;
        const prompt = `Extract named entities and their relationships from the following text. Return ONLY valid JSON matching this schema (no markdown, no explanation):
${schema}

Text:
"""
${chunk.text.slice(0, 4000)}
"""

Rules: Use entity names exactly as they appear. Relationship "from" and "to" must match entity names. Confidence 0-1.`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt,
                    stream: false,
                    format: 'json',
                }),
                signal: controller.signal,
            });
            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`Ollama generate failed (${res.status}): ${errBody}`);
            }
            const data = (await res.json());
            const raw = data.response?.trim() ?? '';
            const jsonStr = this.extractJson(raw);
            const parsed = JSON.parse(jsonStr);
            if (!parsed.entities)
                parsed.entities = [];
            if (!parsed.relationships)
                parsed.relationships = [];
            return parsed;
        }
        catch (err) {
            if (err instanceof Error) {
                if (err.name === 'AbortError') {
                    throw new Error(`Ollama extraction timeout after ${this.timeoutMs}ms`);
                }
                throw err;
            }
            throw new Error('Ollama extraction failed');
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    extractJson(raw) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}') + 1;
        if (start >= 0 && end > start) {
            return raw.slice(start, end);
        }
        return raw;
    }
    makeEntityId(name, documentId, chunkId) {
        return `${name.toLowerCase().replace(/\s+/g, '_')}::${documentId}::${chunkId}`;
    }
    deduplicateEntities(entities) {
        const seen = new Set();
        return entities.filter((e) => {
            const key = `${e.normalized ?? e.name.toLowerCase()}::${e.attributes?.sourceChunkId}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
};
exports.OllamaGraphExtractorAdapter = OllamaGraphExtractorAdapter;
exports.OllamaGraphExtractorAdapter = OllamaGraphExtractorAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OllamaGraphExtractorAdapter);
//# sourceMappingURL=ollama-graph-extractor.adapter.js.map