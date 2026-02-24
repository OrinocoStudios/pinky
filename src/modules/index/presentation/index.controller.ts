import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReindexChunksUseCase } from '../../ingestion/application/reindex-chunks.usecase';
import { ReindexDto } from './index.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';

@Controller('index')
export class IndexController {
  constructor(private readonly reindexChunksUseCase: ReindexChunksUseCase) {}

  @Post('rebuild')
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  @RequireApiKey()
  async rebuild(@Body() body: ReindexDto) {
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'rebuild',
    });
    return result;
  }

  @Post('incremental')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @RequireApiKey()
  async incremental(@Body() body: ReindexDto) {
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'incremental',
    });
    return result;
  }
}
