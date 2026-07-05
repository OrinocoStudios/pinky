import { BadRequestException, Body, Controller, Get, Headers, Inject, Logger, Param, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { GraphRagQueryUseCase } from '../application/graph-rag-query.usecase';
import { SummarizeUseCase } from '../application/summarize.usecase';
import { QueryDto, QueryResponseDto } from './query.dto';
import { SummarizeDto, SummarizeResponseDto } from './summarize.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { BrainConfig } from '../../../config/configuration';
import { CHAT_HISTORY_REPOSITORY } from '../../../shared/di.tokens';
import { ChatHistoryRepositoryPort } from '../domain/ports/chat-history.repository.port';

@Controller()
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(
    private readonly graphRagQueryUseCase: GraphRagQueryUseCase,
    private readonly summarizeUseCase: SummarizeUseCase,
    @Inject(CHAT_HISTORY_REPOSITORY)
    private readonly chatHistory: ChatHistoryRepositoryPort,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Post('query')
  @SkipThrottle({ default: true, upload: true, ingest: true })
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
      sessionId: body.sessionId,
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
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @RequireApiKey()
  async summarize(
    @Body() body: SummarizeDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ): Promise<SummarizeResponseDto> {
    const tenantId = body.tenantId || this.resolveTenantId(tenantHeader);
    const libraryIds = this.resolveLibraryIds(body.libraryId ? [body.libraryId] : undefined, libraryHeader);
    
    const summary = await this.summarizeUseCase.execute({
      messages: body.messages,
      sessionId: body.sessionId,
      tenantId,
      libraryId: libraryIds?.[0],
    });
    return { summary };
  }

  @Get('query/history/:sessionId')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @RequireApiKey()
  async getChatHistory(
    @Param('sessionId') sessionId: string,
  ): Promise<any> {
    return this.chatHistory.getBySessionId(sessionId);
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
