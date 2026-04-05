import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BrainConfig } from '../../config/configuration';
import { AuthTokenPayload } from '../../modules/auth/types/auth-user.type';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly configService: ConfigService<BrainConfig>,
    private readonly jwtService: JwtService,
  ) {
    const appConfig = this.configService.get('app', { infer: true })!;
    const enabled = appConfig.enableApiKeyAuth;
    const apiKey = appConfig.apiKey;

    if (enabled && !apiKey) {
      this.logger.warn('API key authentication is enabled but no API_KEY is configured. All requests will be denied.');
    }

    if (enabled && apiKey) {
      this.logger.log('API key authentication enabled');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      cookies?: Record<string, string | undefined>;
      user?: AuthTokenPayload;
    }>();

    const jwtUser = await this.tryAuthenticateJwt(request);
    if (jwtUser) {
      request.user = jwtUser;
      return true;
    }

    const appConfig = this.configService.get('app', { infer: true })!;
    const authConfig = this.configService.get('auth', { infer: true });
    const webAuthEnabled = Boolean(authConfig?.allowedAdminEmails?.length);

    if (!webAuthEnabled && !appConfig.enableApiKeyAuth) {
      return true;
    }

    if (!appConfig.enableApiKeyAuth) {
      this.logger.warn('Request denied: Missing JWT cookie and API key auth disabled');
      throw new UnauthorizedException('Authentication is required');
    }

    if (!appConfig.apiKey) {
      this.logger.error('API key authentication enabled but no API_KEY configured');
      throw new UnauthorizedException('API key not configured');
    }

    const clientApiKey = request.headers['x-api-key'];

    if (!clientApiKey) {
      this.logger.warn('Request denied: Missing JWT cookie and X-API-Key header');
      throw new UnauthorizedException('Authentication is required');
    }

    const normalizedApiKey = Array.isArray(clientApiKey) ? clientApiKey[0] : clientApiKey;
    if (normalizedApiKey !== appConfig.apiKey) {
      this.logger.warn('Request denied: Invalid API key');
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private async tryAuthenticateJwt(request: {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | undefined>;
  }): Promise<AuthTokenPayload | null> {
    const authConfig = this.configService.get('auth', { infer: true });
    if (!authConfig?.jwtSecret) {
      return null;
    }

    const token = this.extractToken(request, authConfig.cookieName);
    if (!token) {
      return null;
    }

    try {
      return await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: authConfig.jwtSecret,
      });
    } catch {
      this.logger.warn('Request denied: Invalid JWT token');
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractToken(
    request: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string | undefined> },
    cookieName: string,
  ): string | null {
    const cookieToken = request.cookies?.[cookieName];
    if (cookieToken) {
      return cookieToken;
    }

    const authorizationHeader = request.headers.authorization;
    const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
    if (!value?.startsWith('Bearer ')) {
      return null;
    }

    return value.slice('Bearer '.length).trim();
  }
}
