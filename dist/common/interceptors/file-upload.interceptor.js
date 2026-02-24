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
exports.FileUploadInterceptor = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const multer_1 = require("multer");
const DEFAULT_ALLOWED_MIME_TYPES = [
    'text/plain',
    'text/markdown',
    'application/json',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
let FileUploadInterceptor = class FileUploadInterceptor {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async intercept(context, next) {
        const allowedMimeTypes = this.getAllowedMimeTypes();
        const maxFileSize = this.getMaxFileSize();
        const upload = (0, multer_1.default)({
            storage: multer_1.default.memoryStorage(),
            limits: { fileSize: maxFileSize },
            fileFilter: (_req, file, callback) => {
                if (!file?.mimetype) {
                    callback(null, false);
                    return;
                }
                if (allowedMimeTypes.includes(file.mimetype)) {
                    callback(null, true);
                }
                else {
                    callback(new common_1.BadRequestException(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`));
                }
            },
        });
        const ctx = context.switchToHttp();
        await new Promise((resolve, reject) => {
            upload.single('file')(ctx.getRequest(), ctx.getResponse(), (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        return next.handle();
    }
    getAllowedMimeTypes() {
        const allowedMimeTypes = this.configService.get('app.allowedMimeTypes', {
            infer: true,
        });
        if (Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0) {
            return allowedMimeTypes;
        }
        if (typeof allowedMimeTypes === 'string' && allowedMimeTypes.trim().length > 0) {
            return allowedMimeTypes.split(',').map((item) => item.trim()).filter(Boolean);
        }
        return DEFAULT_ALLOWED_MIME_TYPES;
    }
    getMaxFileSize() {
        const maxFileSizeMB = this.configService.get('app.maxFileSizeMB', { infer: true });
        if (maxFileSizeMB) {
            return maxFileSizeMB * 1024 * 1024;
        }
        return DEFAULT_MAX_FILE_SIZE;
    }
};
exports.FileUploadInterceptor = FileUploadInterceptor;
exports.FileUploadInterceptor = FileUploadInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FileUploadInterceptor);
//# sourceMappingURL=file-upload.interceptor.js.map