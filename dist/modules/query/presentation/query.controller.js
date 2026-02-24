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
var QueryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const graph_rag_query_usecase_1 = require("../application/graph-rag-query.usecase");
const query_dto_1 = require("./query.dto");
const require_api_key_decorator_1 = require("../../../common/decorators/require-api-key.decorator");
let QueryController = QueryController_1 = class QueryController {
    graphRagQueryUseCase;
    logger = new common_1.Logger(QueryController_1.name);
    constructor(graphRagQueryUseCase) {
        this.graphRagQueryUseCase = graphRagQueryUseCase;
    }
    async query(body) {
        this.logger.log(`Received query: "${body.query.substring(0, 100)}${body.query.length > 100 ? '...' : ''}"`);
        const result = await this.graphRagQueryUseCase.execute({
            query: body.query,
            entityHints: body.entityHints,
            topK: body.topK ?? 8,
        });
        this.logger.log(`Query completed: model=${result.model}, tokens=${result.tokensUsed}, sources_cited=${result.sourcesUsed.length}`);
        return {
            answer: result.answer,
            sourcesUsed: result.sourcesUsed,
            fastContext: result.fastContext,
            truthFacts: result.truthFacts,
            model: result.model,
            tokensUsed: result.tokensUsed,
            prompt: result.prompt,
        };
    }
};
exports.QueryController = QueryController;
__decorate([
    (0, common_1.Post)('query'),
    (0, throttler_1.Throttle)({ query: {} }),
    (0, require_api_key_decorator_1.RequireApiKey)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_dto_1.QueryDto]),
    __metadata("design:returntype", Promise)
], QueryController.prototype, "query", null);
exports.QueryController = QueryController = QueryController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [graph_rag_query_usecase_1.GraphRagQueryUseCase])
], QueryController);
//# sourceMappingURL=query.controller.js.map