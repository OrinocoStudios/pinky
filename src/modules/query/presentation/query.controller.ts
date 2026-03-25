import { BadRequestException, Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { GraphRagQueryUseCase } from '../application/graph-rag-query.usecase';
import { SummarizeUseCase } from '../application/summarize.usecase';
import { QueryDto, QueryResponseDto } from './query.dto';
import { SummarizeDto, SummarizeResponseDto } from './summarize.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { BrainConfig } from '../../../config/configuration';

@Controller()
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(
    private readonly graphRagQueryUseCase: GraphRagQueryUseCase,
    private readonly summarizeUseCase: SummarizeUseCase,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Post('query')
  @Throttle({ query: {} })
  @RequireApiKey()
  async query(
    @Body() body: QueryDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ): Promise<QueryResponseDto> {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryIds = this.resolveLibraryIds(body.libraryIds, libraryHeader);
    this.logger.log(`Received query: "${body.query.substring(0, 100)}${body.query.length > 100 ? '...' : ''}"`);

    const result = await this.graphRagQueryUseCase.execute({
      tenantId,
      libraryIds,
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

  @Post('summarize')
  @RequireApiKey()
  async summarize(@Body() body: SummarizeDto): Promise<SummarizeResponseDto> {
    const summary = await this.summarizeUseCase.execute({
      messages: body.messages,
    });
    return { summary };
  }

  private resolveTenantId(rawTenantId?: string): string | undefined {
    const enableMultiTenant = this.configService.get('app.enableMultiTenant', { infer: true }) ?? false;
    const tenantId = rawTenantId?.trim();
    if (enableMultiTenant && !tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required when ENABLE_MULTI_TENANT=true');
    }
    return tenantId;
  }

  private resolveLibraryIds(bodyLibraryIds?: string[], libraryHeader?: string): string[] | undefined {
    const normalizedBodyLibraryIds = (bodyLibraryIds ?? []).map((libraryId) => libraryId.trim()).filter(Boolean);
    if (normalizedBodyLibraryIds.length > 0) {
      return [...new Set(normalizedBodyLibraryIds)];
    }

    const normalizedHeaderLibraryId = libraryHeader?.trim();
    return normalizedHeaderLibraryId ? [normalizedHeaderLibraryId] : undefined;
  }
}
