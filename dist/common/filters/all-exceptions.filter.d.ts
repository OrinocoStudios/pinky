import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../../config/configuration';
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService<BrainConfig>);
    catch(exception: unknown, host: ArgumentsHost): void;
}
