import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/api-key.guard';
import { ApiPrincipal } from '../security/api-principal';

/**
 * The credential behind the request, as resolved by ApiKeyGuard.
 * Undefined only on routes reachable with authentication disabled entirely.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiPrincipal | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().apiPrincipal,
);
