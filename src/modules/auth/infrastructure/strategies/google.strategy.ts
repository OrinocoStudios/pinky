import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { BrainConfig } from '../../../../config/configuration';
import { AuthService } from '../../application/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService<BrainConfig>,
    private readonly authService: AuthService,
  ) {
    const authConfig = configService.get('auth', { infer: true })!;
    super({
      clientID: authConfig.googleClientId,
      clientSecret: authConfig.googleClientSecret,
      callbackURL: authConfig.googleCallbackUrl,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      done(new UnauthorizedException('Google account does not expose an email'), false);
      return;
    }

    const user = this.authService.createUser({
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      provider: 'google',
      providerUserId: profile.id,
    });

    done(null, user);
  }
}
