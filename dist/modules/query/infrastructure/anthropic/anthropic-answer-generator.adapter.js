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
var AnthropicAnswerGeneratorAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAnswerGeneratorAdapter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
let AnthropicAnswerGeneratorAdapter = AnthropicAnswerGeneratorAdapter_1 = class AnthropicAnswerGeneratorAdapter {
    configService;
    logger = new common_1.Logger(AnthropicAnswerGeneratorAdapter_1.name);
    client;
    model;
    temperature;
    maxTokens;
    timeoutMs;
    constructor(configService) {
        this.configService = configService;
        const llmConfig = this.configService.get('llm', { infer: true });
        const anthropicConfig = llmConfig.anthropic;
        this.client = anthropicConfig.apiKey
            ? new sdk_1.default({
                apiKey: anthropicConfig.apiKey,
                timeout: anthropicConfig.timeoutMs,
                maxRetries: 3,
            })
            : null;
        this.model = anthropicConfig.model;
        this.temperature = anthropicConfig.temperature;
        this.maxTokens = anthropicConfig.maxTokens;
        this.timeoutMs = anthropicConfig.timeoutMs;
        this.logger.log(`Initialized Anthropic adapter with model=${this.model}, temperature=${this.temperature}, maxTokens=${this.maxTokens}`);
    }
    async generate(input) {
        if (!this.client) {
            throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
        }
        const startTime = Date.now();
        try {
            this.logger.debug(`Generating answer with ${input.sources.length} sources`);
            const response = await this.client.messages.create({
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
            const textBlock = response.content.find((block) => block.type === 'text');
            const answer = textBlock && 'text' in textBlock ? textBlock.text : '';
            const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);
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
            if (error instanceof sdk_1.default.APIError) {
                if (error.status === 401) {
                    throw new Error('Anthropic authentication failed. Check ANTHROPIC_API_KEY');
                }
                if (error.status === 429) {
                    throw new Error('Anthropic rate limit exceeded. Retry later');
                }
                if (error.status === 404) {
                    throw new Error(`Anthropic model not found: ${this.model}`);
                }
                throw new Error(`Anthropic API error: ${error.message}`);
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
exports.AnthropicAnswerGeneratorAdapter = AnthropicAnswerGeneratorAdapter;
exports.AnthropicAnswerGeneratorAdapter = AnthropicAnswerGeneratorAdapter = AnthropicAnswerGeneratorAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AnthropicAnswerGeneratorAdapter);
//# sourceMappingURL=anthropic-answer-generator.adapter.js.map