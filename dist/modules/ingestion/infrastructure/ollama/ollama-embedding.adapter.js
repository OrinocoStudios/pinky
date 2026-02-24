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
exports.OllamaEmbeddingAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let OllamaEmbeddingAdapter = class OllamaEmbeddingAdapter {
    configService;
    baseUrl;
    model;
    timeoutMs;
    constructor(configService) {
        this.configService = configService;
        const ollama = configService.get('ollama', { infer: true });
        this.baseUrl = ollama?.baseUrl ?? 'http://localhost:11434';
        this.model = ollama?.embeddingModel ?? 'nomic-embed-text';
        this.timeoutMs = ollama?.timeoutMs ?? 30000;
    }
    async embed(text) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(`${this.baseUrl}/api/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: this.model, input: text }),
                signal: controller.signal,
            });
            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`Ollama embed failed (${res.status}): ${errBody}`);
            }
            const data = (await res.json());
            const vector = data.embeddings?.[0];
            if (!Array.isArray(vector) || vector.length === 0) {
                throw new Error('Ollama returned empty or invalid embedding');
            }
            return this.normalize(vector);
        }
        catch (err) {
            if (err instanceof Error) {
                if (err.name === 'AbortError') {
                    throw new Error(`Ollama embed timeout after ${this.timeoutMs}ms`);
                }
                throw err;
            }
            throw new Error('Ollama embed failed');
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    getModelId() {
        return this.model;
    }
    normalize(vec) {
        const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
        return vec.map((v) => v / norm);
    }
};
exports.OllamaEmbeddingAdapter = OllamaEmbeddingAdapter;
exports.OllamaEmbeddingAdapter = OllamaEmbeddingAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OllamaEmbeddingAdapter);
//# sourceMappingURL=ollama-embedding.adapter.js.map