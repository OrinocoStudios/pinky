import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../../config/configuration';
export declare class ApiKeyGuard implements CanActivate {
    private readonly configService;
    private readonly logger;
    private readonly apiKey;
    private readonly enabled;
    constructor(configService: ConfigService<BrainConfig>);
    canActivate(context: ExecutionContext): boolean;
}
