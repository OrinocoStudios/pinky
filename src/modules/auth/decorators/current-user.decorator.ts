import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user.type';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthUser | undefined => {
  const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
  return request.user;
});
