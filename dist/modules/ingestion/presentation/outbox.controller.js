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
exports.OutboxController = void 0;
const common_1 = require("@nestjs/common");
const graph_sync_retry_service_1 = require("../application/graph-sync-retry.service");
const retry_outbox_dto_1 = require("./retry-outbox.dto");
const require_api_key_decorator_1 = require("../../../common/decorators/require-api-key.decorator");
let OutboxController = class OutboxController {
    retryService;
    constructor(retryService) {
        this.retryService = retryService;
    }
    async retry(body) {
        const limit = body.limit ?? 20;
        return this.retryService.retry(limit);
    }
};
exports.OutboxController = OutboxController;
__decorate([
    (0, common_1.Post)('retry'),
    (0, require_api_key_decorator_1.RequireApiKey)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [retry_outbox_dto_1.RetryOutboxDto]),
    __metadata("design:returntype", Promise)
], OutboxController.prototype, "retry", null);
exports.OutboxController = OutboxController = __decorate([
    (0, common_1.Controller)('outbox'),
    __metadata("design:paramtypes", [graph_sync_retry_service_1.GraphSyncRetryService])
], OutboxController);
//# sourceMappingURL=outbox.controller.js.map