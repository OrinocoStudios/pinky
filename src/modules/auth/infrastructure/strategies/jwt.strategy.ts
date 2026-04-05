import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { BrainConfig } from '../../../../config/configuration';
import { AuthTokenPayload } from '../../types/auth-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService<BrainConfig>) {
    const authConfig = configService.get('auth', { infer: true })!;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request.cookies?.[authConfig.cookieName] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtSecret,
    });
  }

  validate(payload: AuthTokenPayload): AuthTokenPayload {
    return payload;
  }
}
