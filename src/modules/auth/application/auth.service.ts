import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { BrainConfig } from '../../../config/configuration';
import { AuthProvider, AuthTokenPayload, AuthUser } from '../types/auth-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  createUser(params: {
    email: string;
    name?: string;
    avatarUrl?: string;
    provider: AuthProvider;
    providerUserId: string;
  }): AuthUser {
    const email = params.email.trim().toLowerCase();
    const allowedEmails = this.configService.get('auth.allowedAdminEmails', { infer: true }) ?? [];

    if (!allowedEmails.includes(email)) {
      throw new ForbiddenException('Your account is not allowed to access this system');
    }

    return {
      email,
      name: params.name?.trim() || email,
      avatarUrl: params.avatarUrl,
      provider: params.provider,
      providerUserId: params.providerUserId,
      isAdmin: true,
    };
  }

  async signToken(user: AuthUser): Promise<string> {
    const payload: AuthTokenPayload = {
      sub: `${user.provider}:${user.providerUserId}`,
      ...user,
    };

    return this.jwtService.signAsync(payload);
  }

  attachAuthCookie(response: Response, token: string): void {
    const authConfig = this.configService.get('auth', { infer: true })!;
    response.cookie(authConfig.cookieName, token, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: authConfig.cookieSameSite,
      path: '/',
      maxAge: this.resolveCookieMaxAge(authConfig.jwtExpiresIn),
    });
  }

  clearAuthCookie(response: Response): void {
    const authConfig = this.configService.get('auth', { infer: true })!;
    response.clearCookie(authConfig.cookieName, {
      httpOnly: true,
      secure: authConfig.cookieSecure,
      sameSite: authConfig.cookieSameSite,
      path: '/',
    });
  }

  private resolveCookieMaxAge(value: string): number | undefined {
    const match = value.trim().match(/^(\d+)([smhd])$/i);
    if (!match) {
      return undefined;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return amount * multipliers[unit];
  }
}
