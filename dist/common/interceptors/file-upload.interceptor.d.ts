import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../../config/configuration';
export declare class FileUploadInterceptor implements NestInterceptor {
    private readonly configService;
    constructor(configService: ConfigService<BrainConfig>);
    intercept(context: ExecutionContext, next: CallHandler): Promise<ReturnType<CallHandler['handle']>>;
    private getAllowedMimeTypes;
    private getMaxFileSize;
}
