import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ReindexChunksUseCase } from '../../ingestion/application/reindex-chunks.usecase';
import { ReindexDto } from './index.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { CurrentPrincipal } from '../../../common/decorators/current-principal.decorator';
import { ApiPrincipal } from '../../../common/security/api-principal';
import { RequestScope, resolveRequestScope } from '../../../common/security/request-scope';
import { BrainConfig } from '../../../config/configuration';

@Controller('index')
export class IndexController {
  constructor(
    private readonly reindexChunksUseCase: ReindexChunksUseCase,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Post('rebuild')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  @RequireApiKey()
  async rebuild(
    @Body() body: ReindexDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'rebuild',
      tenantId,
      libraryId,
    });
    return result;
  }

  @Post('incremental')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @RequireApiKey()
  async incremental(
    @Body() body: ReindexDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'incremental',
      tenantId,
      libraryId,
    });
    return result;
  }

  private resolveScope(
    principal: ApiPrincipal | undefined,
    tenantHeader?: string,
    libraryHeader?: string,
  ): RequestScope {
    return resolveRequestScope({
      principal,
      tenantHeader,
      libraryHeader,
      enableMultiTenant: this.configService.get('app.enableMultiTenant', { infer: true }) ?? false,
    });
  }

}
