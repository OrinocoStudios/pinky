import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') {
  override getAuthenticateOptions(_context: ExecutionContext) {
    return {
      scope: ['email', 'profile'],
    };
  }
}
