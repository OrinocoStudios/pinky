import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { BrainConfig } from '../../config/configuration';
export declare class DocumentUploadInterceptor implements NestInterceptor {
    private readonly configService;
    constructor(configService: ConfigService<BrainConfig>);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
