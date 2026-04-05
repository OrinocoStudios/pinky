import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GithubOauthGuard extends AuthGuard('github') {
  override getAuthenticateOptions(_context: ExecutionContext) {
    return {
      scope: ['read:user', 'user:email'],
    };
  }
}
