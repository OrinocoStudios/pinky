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
var OpenAiAnswerGeneratorAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiAnswerGeneratorAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = require("openai");
let OpenAiAnswerGeneratorAdapter = OpenAiAnswerGeneratorAdapter_1 = class OpenAiAnswerGeneratorAdapter {
    configService;
    logger = new common_1.Logger(OpenAiAnswerGeneratorAdapter_1.name);
    client;
    model;
    temperature;
    maxTokens;
    timeoutMs;
    constructor(configService) {
        this.configService = configService;
        const llmConfig = this.configService.get('llm', { infer: true });
        const openaiConfig = llmConfig.openai;
        this.client = openaiConfig.apiKey
            ? new openai_1.default({
                apiKey: openaiConfig.apiKey,
                timeout: openaiConfig.timeoutMs,
                maxRetries: 3,
            })
            : null;
        this.model = openaiConfig.model;
        this.temperature = openaiConfig.temperature;
        this.maxTokens = openaiConfig.maxTokens;
        this.timeoutMs = openaiConfig.timeoutMs;
        this.logger.log(`Initialized OpenAI adapter with model=${this.model}, temperature=${this.temperature}, maxTokens=${this.maxTokens}`);
    }
    async generate(input) {
        if (!this.client) {
            throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
        }
        const startTime = Date.now();
        try {
            this.logger.debug(`Generating answer with ${input.sources.length} sources`);
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: input.prompt,
                    },
                ],
                temperature: this.temperature,
                max_tokens: input.maxTokens ?? this.maxTokens,
            });
            const answer = response.choices[0]?.message?.content ?? '';
            const tokensUsed = response.usage?.total_tokens ?? 0;
            const sourcesUsed = this.extractCitedSources(answer, input.sources.map((s) => s.id));
            const latency = Date.now() - startTime;
            this.logger.log(`Generated answer in ${latency}ms, tokens=${tokensUsed}, sources_cited=${sourcesUsed.length}`);
            return {
                answer,
                sourcesUsed,
                model: this.model,
                tokensUsed,
            };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            this.logger.error(`Failed to generate answer after ${latency}ms: ${error}`);
            if (error instanceof openai_1.default.APIError) {
                if (error.status === 401) {
                    throw new Error('OpenAI authentication failed. Check OPENAI_API_KEY');
                }
                if (error.status === 429) {
                    throw new Error('OpenAI rate limit exceeded. Retry later');
                }
                if (error.status === 404) {
                    throw new Error(`OpenAI model not found: ${this.model}`);
                }
                throw new Error(`OpenAI API error: ${error.message}`);
            }
            throw new Error(`Unexpected error generating answer: ${error}`);
        }
    }
    extractCitedSources(answer, availableSourceIds) {
        const citationPattern = /\[(CTX-\d+|FACT-\d+)\]/g;
        const matches = answer.matchAll(citationPattern);
        const cited = new Set();
        for (const match of matches) {
            const sourceId = match[1];
            if (availableSourceIds.includes(sourceId)) {
                cited.add(sourceId);
            }
        }
        return Array.from(cited);
    }
};
exports.OpenAiAnswerGeneratorAdapter = OpenAiAnswerGeneratorAdapter;
exports.OpenAiAnswerGeneratorAdapter = OpenAiAnswerGeneratorAdapter = OpenAiAnswerGeneratorAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiAnswerGeneratorAdapter);
//# sourceMappingURL=openai-answer-generator.adapter.js.map