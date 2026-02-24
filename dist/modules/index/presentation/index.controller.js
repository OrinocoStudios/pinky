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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexController = void 0;
const common_1 = require("@nestjs/common");
const reindex_chunks_usecase_1 = require("../../ingestion/application/reindex-chunks.usecase");
const index_dto_1 = require("./index.dto");
let IndexController = class IndexController {
    reindexChunksUseCase;
    constructor(reindexChunksUseCase) {
        this.reindexChunksUseCase = reindexChunksUseCase;
    }
    async rebuild(body) {
        const result = await this.reindexChunksUseCase.execute({
            limit: body.limit,
            mode: 'rebuild',
        });
        return result;
    }
    async incremental(body) {
        const result = await this.reindexChunksUseCase.execute({
            limit: body.limit,
            mode: 'incremental',
        });
        return result;
    }
};
exports.IndexController = IndexController;
__decorate([
    (0, common_1.Post)('rebuild'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_dto_1.ReindexDto]),
    __metadata("design:returntype", Promise)
], IndexController.prototype, "rebuild", null);
__decorate([
    (0, common_1.Post)('incremental'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [index_dto_1.ReindexDto]),
    __metadata("design:returntype", Promise)
], IndexController.prototype, "incremental", null);
exports.IndexController = IndexController = __decorate([
    (0, common_1.Controller)('index'),
    __metadata("design:paramtypes", [reindex_chunks_usecase_1.ReindexChunksUseCase])
], IndexController);
//# sourceMappingURL=index.controller.js.map