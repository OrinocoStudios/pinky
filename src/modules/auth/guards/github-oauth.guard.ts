import { ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { BrainConfig } from '../../../config/configuration';

@Injectable()
export class GithubOauthGuard extends AuthGuard('github') {
  constructor(private readonly configService: ConfigService<BrainConfig>) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isEnabled = this.configService.get('auth.githubOauthEnabled', { infer: true }) ?? false;
    if (!isEnabled) {
      throw new NotFoundException('GitHub OAuth is disabled');
    }
    return super.canActivate(context);
  }
  override getAuthenticateOptions(_context: ExecutionContext) {
    return {
      scope: ['read:user', 'user:email'],
    };
  }
}
