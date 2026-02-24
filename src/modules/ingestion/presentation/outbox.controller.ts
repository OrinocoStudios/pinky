import { Body, Controller, Post } from '@nestjs/common';
import { GraphSyncRetryService } from '../application/graph-sync-retry.service';
import { RetryOutboxDto } from './retry-outbox.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';

@Controller('outbox')
export class OutboxController {
  constructor(private readonly retryService: GraphSyncRetryService) {}

  @Post('retry')
  @RequireApiKey()
  async retry(@Body() body: RetryOutboxDto) {
    const limit = body.limit ?? 20;
    return this.retryService.retry(limit);
  }
}
