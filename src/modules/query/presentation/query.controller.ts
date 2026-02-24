import { Body, Controller, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GraphRagQueryUseCase } from '../application/graph-rag-query.usecase';
import { QueryDto, QueryResponseDto } from './query.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';

@Controller()
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(private readonly graphRagQueryUseCase: GraphRagQueryUseCase) {}

  @Post('query')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @RequireApiKey()
  async query(@Body() body: QueryDto): Promise<QueryResponseDto> {
    this.logger.log(`Received query: "${body.query.substring(0, 100)}${body.query.length > 100 ? '...' : ''}"`);

    const result = await this.graphRagQueryUseCase.execute({
      query: body.query,
      entityHints: body.entityHints,
      topK: body.topK ?? 8,
    });

    this.logger.log(
      `Query completed: model=${result.model}, tokens=${result.tokensUsed}, sources_cited=${result.sourcesUsed.length}`,
    );

    return {
      answer: result.answer,
      sourcesUsed: result.sourcesUsed,
      fastContext: result.fastContext,
      truthFacts: result.truthFacts,
      model: result.model,
      tokensUsed: result.tokensUsed,
      prompt: result.prompt,
    };
  }
}
