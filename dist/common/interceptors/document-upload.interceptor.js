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
exports.DocumentUploadInterceptor = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const multer = require("multer");
const DEFAULT_ALLOWED_MIME_TYPES = [
    'text/plain',
    'text/markdown',
    'application/json',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
let DocumentUploadInterceptor = class DocumentUploadInterceptor {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    intercept(context, next) {
        const rawAllowed = this.configService.get('app.allowedMimeTypes', { infer: true });
        const allowed = Array.isArray(rawAllowed)
            ? rawAllowed
            : rawAllowed
                ? [rawAllowed]
                : DEFAULT_ALLOWED_MIME_TYPES;
        const maxSizeMB = this.configService.get('app.maxFileSizeMB', { infer: true }) ?? 10;
        const maxFileSize = maxSizeMB * 1024 * 1024;
        const multerMiddleware = multer({
            limits: { fileSize: maxFileSize },
            fileFilter: (_req, file, callback) => {
                if (!file?.mimetype) {
                    callback(null, false);
                    return;
                }
                if (allowed.includes(file.mimetype)) {
                    callback(null, true);
                }
                else {
                    callback(new common_1.BadRequestException(`File type not allowed. Allowed types: ${allowed.join(', ') || 'none'}`), false);
                }
            },
        }).single('file');
        const ctx = context.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();
        return (0, rxjs_1.from)(new Promise((resolve, reject) => {
            multerMiddleware(req, res, (err) => {
                if (err) {
                    reject(err instanceof common_1.HttpException
                        ? err
                        : err instanceof Error && err.message === 'File too large'
                            ? new common_1.PayloadTooLargeException(err.message)
                            : new common_1.BadRequestException(err instanceof Error ? err.message : 'Upload failed'));
                }
                else {
                    resolve();
                }
            });
        })).pipe((0, operators_1.switchMap)(() => next.handle()));
    }
};
exports.DocumentUploadInterceptor = DocumentUploadInterceptor;
exports.DocumentUploadInterceptor = DocumentUploadInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DocumentUploadInterceptor);
//# sourceMappingURL=document-upload.interceptor.js.map