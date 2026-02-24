import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../../config/configuration';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const appConfig = this.configService.get('app', { infer: true })!;
    this.enabled = appConfig.enableApiKeyAuth;
    this.apiKey = appConfig.apiKey;

    if (this.enabled && !this.apiKey) {
      this.logger.warn('API key authentication is enabled but no API_KEY is configured. All requests will be denied.');
    }

    if (this.enabled && this.apiKey) {
      this.logger.log('API key authentication enabled');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // Si la autenticación está deshabilitada, permitir todo
    if (!this.enabled) {
      return true;
    }

    // Si no hay API key configurada denegar
    if (!this.apiKey) {
      this.logger.error('API key authentication enabled but no API_KEY configured');
      throw new UnauthorizedException('API key not configured');
    }

    const request = context.switchToHttp().getRequest();
    const clientApiKey = request.headers['x-api-key'];

    if (!clientApiKey) {
      this.logger.warn('Request denied: Missing X-API-Key header');
      throw new UnauthorizedException('API key is required');
    }

    if (clientApiKey !== this.apiKey) {
      this.logger.warn('Request denied: Invalid API key');
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}