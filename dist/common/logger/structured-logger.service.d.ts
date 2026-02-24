import { LoggerService } from '@nestjs/common';
export type LogMeta = Record<string, unknown>;
export declare class StructuredLogger implements LoggerService {
    log(message: string, context?: string, meta?: LogMeta): void;
    error(message: string, trace?: string, context?: string, meta?: LogMeta): void;
    warn(message: string, context?: string, meta?: LogMeta): void;
    debug(message: string, context?: string, meta?: LogMeta): void;
    verbose(message: string, context?: string, meta?: LogMeta): void;
    private output;
}
