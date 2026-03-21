import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ReindexChunksUseCase } from '../../ingestion/application/reindex-chunks.usecase';
import { ReindexDto } from './index.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { BrainConfig } from '../../../config/configuration';

@Controller('index')
export class IndexController {
  constructor(
    private readonly reindexChunksUseCase: ReindexChunksUseCase,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Post('rebuild')
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  @RequireApiKey()
  async rebuild(
    @Body() body: ReindexDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'rebuild',
      tenantId,
      libraryId,
    });
    return result;
  }

  @Post('incremental')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @RequireApiKey()
  async incremental(
    @Body() body: ReindexDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'incremental',
      tenantId,
      libraryId,
    });
    return result;
  }

  private resolveTenantId(rawTenantId?: string): string | undefined {
    const enableMultiTenant = this.configService.get('app.enableMultiTenant', { infer: true }) ?? false;
    const tenantId = rawTenantId?.trim();
    if (enableMultiTenant && !tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required when ENABLE_MULTI_TENANT=true');
    }
    return tenantId;
  }

  private resolveLibraryId(rawLibraryId?: string): string | undefined {
    const libraryId = rawLibraryId?.trim();
    return libraryId && libraryId.length > 0 ? libraryId : undefined;
  }
}
