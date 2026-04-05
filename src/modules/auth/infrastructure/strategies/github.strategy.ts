import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { BrainConfig } from '../../../../config/configuration';
import { AuthService } from '../../application/auth.service';

type GithubEmailRecord = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: 'public' | 'private' | null;
};

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    configService: ConfigService<BrainConfig>,
    private readonly authService: AuthService,
  ) {
    const authConfig = configService.get('auth', { infer: true })!;
    super({
      clientID: authConfig.githubClientId,
      clientSecret: authConfig.githubClientSecret,
      callbackURL: authConfig.githubCallbackUrl,
      scope: ['read:user', 'user:email'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: unknown, user?: unknown) => void,
  ): Promise<void> {
    try {
      const email = await this.resolveVerifiedEmail(accessToken, profile);
      const user = this.authService.createUser({
        email,
        name: profile.displayName || profile.username,
        avatarUrl: profile.photos?.[0]?.value,
        provider: 'github',
        providerUserId: profile.id,
      });
      done(null, user);
    } catch (error) {
      done(error instanceof Error ? error : new UnauthorizedException('GitHub authentication failed'), false);
    }
  }

  private async resolveVerifiedEmail(accessToken: string, profile: Profile): Promise<string> {
    const directEmail = profile.emails?.[0]?.value;
    if (directEmail) {
      return directEmail;
    }

    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'pinky-auth',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Unable to resolve GitHub email');
    }

    const emails = (await response.json()) as GithubEmailRecord[];
    const selected = emails.find((item) => item.primary && item.verified) ?? emails.find((item) => item.verified);

    if (!selected?.email) {
      throw new UnauthorizedException('GitHub account does not expose a verified email');
    }

    return selected.email;
  }
}
