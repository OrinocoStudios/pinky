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
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    configService;
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const isProd = this.configService.get('app.env', { infer: true }) === 'production';
        let status;
        let message;
        let errorDetail;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            const rawMessage = typeof exceptionResponse === 'string'
                ? exceptionResponse
                : exceptionResponse.message ?? exception.message;
            message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;
            errorDetail = typeof exceptionResponse === 'object' ? exceptionResponse : undefined;
        }
        else {
            status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            message = isProd
                ? 'Internal server error'
                : exception instanceof Error
                    ? exception.message
                    : 'Unknown error';
            errorDetail = isProd ? undefined : exception instanceof Error ? exception.stack : String(exception);
            if (status >= 500) {
                this.logger.error(`Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`, exception instanceof Error ? exception.stack : undefined);
            }
        }
        const body = {
            statusCode: status,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        };
        if (errorDetail !== undefined) {
            body.error = errorDetail;
        }
        response.status(status).json(body);
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map