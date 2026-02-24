import { Body, Controller, Post } from '@nestjs/common';
import { ReindexChunksUseCase } from '../../ingestion/application/reindex-chunks.usecase';
import { ReindexDto } from './index.dto';

@Controller('index')
export class IndexController {
  constructor(private readonly reindexChunksUseCase: ReindexChunksUseCase) {}

  @Post('rebuild')
  async rebuild(@Body() body: ReindexDto) {
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'rebuild',
    });
    return result;
  }

  @Post('incremental')
  async incremental(@Body() body: ReindexDto) {
    const result = await this.reindexChunksUseCase.execute({
      limit: body.limit,
      mode: 'incremental',
    });
    return result;
  }
}
