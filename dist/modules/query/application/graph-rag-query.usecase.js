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
var GraphRagQueryUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRagQueryUseCase = void 0;
const common_1 = require("@nestjs/common");
const di_tokens_1 = require("../../../shared/di.tokens");
const prompt_template_service_1 = require("./prompt-template.service");
let GraphRagQueryUseCase = GraphRagQueryUseCase_1 = class GraphRagQueryUseCase {
    chunkSearch;
    graphStore;
    answerGenerator;
    promptTemplate;
    logger = new common_1.Logger(GraphRagQueryUseCase_1.name);
    constructor(chunkSearch, graphStore, answerGenerator, promptTemplate) {
        this.chunkSearch = chunkSearch;
        this.graphStore = graphStore;
        this.answerGenerator = answerGenerator;
        this.promptTemplate = promptTemplate;
    }
    async execute(input) {
        const startTime = Date.now();
        try {
            const chunks = await this.chunkSearch.hybridSearch({
                queryText: input.query,
                topK: input.topK,
            });
            this.logger.debug(`Retrieved ${chunks.length} chunks`);
            const entityHints = input.entityHints?.length
                ? input.entityHints
                : this.extractEntityHintsFromQuery(input.query);
            const entities = await this.graphStore.findEntitiesByNames(entityHints);
            const relations = await this.graphStore.findRelationshipsForEntityIds(entities.map((e) => e.entityId));
            this.logger.debug(`Retrieved ${entities.length} entities and ${relations.length} relations`);
            const contextSources = chunks.map((chunk, index) => ({
                id: chunk.chunkId,
                text: chunk.text,
            }));
            const graphFacts = relations.map((rel) => ({
                id: rel.sourceChunkId,
                fromEntityId: rel.fromEntityId,
                type: rel.type,
                toEntityId: rel.toEntityId,
                confidence: rel.confidence,
            }));
            const { prompt, sources } = this.promptTemplate.buildGroundedPrompt({
                query: input.query,
                contextSources,
                graphFacts,
            });
            const result = await this.answerGenerator.generate({
                prompt,
                sources,
                maxTokens: undefined,
            });
            const latency = Date.now() - startTime;
            this.logger.log(`Query completed in ${latency}ms, model=${result.model}, tokens=${result.tokensUsed}, sources_cited=${result.sourcesUsed.length}`);
            return {
                prompt,
                answer: result.answer,
                sourcesUsed: result.sourcesUsed,
                fastContext: contextSources,
                truthFacts: graphFacts.map((f) => ({
                    id: f.id,
                    from: f.fromEntityId,
                    relation: f.type,
                    to: f.toEntityId,
                })),
                model: result.model,
                tokensUsed: result.tokensUsed,
            };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            this.logger.error(`Query failed after ${latency}ms: ${error}`);
            return {
                prompt: '',
                answer: `Lo siento, ocurrió un error al procesar tu consulta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                sourcesUsed: [],
                fastContext: [],
                truthFacts: [],
            };
        }
    }
    extractEntityHintsFromQuery(query) {
        const cleaned = query
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 3);
        return [...new Set(cleaned)].slice(0, 8);
    }
};
exports.GraphRagQueryUseCase = GraphRagQueryUseCase;
exports.GraphRagQueryUseCase = GraphRagQueryUseCase = GraphRagQueryUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.CHUNK_SEARCH_PORT)),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __param(2, (0, common_1.Inject)(di_tokens_1.ANSWER_GENERATOR_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, prompt_template_service_1.PromptTemplateService])
], GraphRagQueryUseCase);
//# sourceMappingURL=graph-rag-query.usecase.js.map