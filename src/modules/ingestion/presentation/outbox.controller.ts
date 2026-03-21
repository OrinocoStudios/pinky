import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphSyncRetryService } from '../application/graph-sync-retry.service';
import { RetryOutboxDto } from './retry-outbox.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { BrainConfig } from '../../../config/configuration';

@Controller('outbox')
export class OutboxController {
  constructor(
    private readonly retryService: GraphSyncRetryService,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Post('retry')
  @RequireApiKey()
  async retry(
    @Body() body: RetryOutboxDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    const limit = body.limit ?? 20;
    return this.retryService.retry(limit, tenantId, libraryId);
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
