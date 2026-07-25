import { BadRequestException, Body, Controller, Get, Headers, Inject, Logger, Param, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { GraphRagQueryUseCase } from '../application/graph-rag-query.usecase';
import { SummarizeUseCase } from '../application/summarize.usecase';
import { QueryDto, QueryResponseDto, RetrieveResponseDto } from './query.dto';
import { SummarizeDto, SummarizeResponseDto } from './summarize.dto';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { CurrentPrincipal } from '../../../common/decorators/current-principal.decorator';
import { ApiPrincipal } from '../../../common/security/api-principal';
import { resolveRequestLibraryIds, resolveRequestTenant } from '../../../common/security/request-scope';
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
    @CurrentPrincipal() principal?: ApiPrincipal,
  ): Promise<QueryResponseDto> {
    const tenantId = this.resolveTenant(principal, tenantHeader);
    const libraryIds = resolveRequestLibraryIds(principal, body.libraryIds, libraryHeader);
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

  @Post('retrieve')
  @SkipThrottle({ default: true, upload: true, ingest: true })
  @Throttle({ query: {} })
  @RequireApiKey()
  async retrieve(
    @Body() body: QueryDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ): Promise<RetrieveResponseDto> {
    const tenantId = this.resolveTenant(principal, tenantHeader);
    const libraryIds = resolveRequestLibraryIds(principal, body.libraryIds, libraryHeader);
    this.logger.log(`Received retrieve: "${body.query.substring(0, 100)}${body.query.length > 100 ? '...' : ''}"`);

    const result = await this.graphRagQueryUseCase.retrieve({
      tenantId,
      libraryIds,
      query: body.query,
      entityHints: body.entityHints,
      topK: body.topK ?? 8,
    });

    this.logger.log(
      `Retrieve completed: chunks=${result.fastContext.length}, facts=${result.truthFacts.length}`,
    );

    return {
      fastContext: result.fastContext,
      truthFacts: result.truthFacts,
    };
  }

  @Post('summarize')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @RequireApiKey()
  async summarize(
    @Body() body: SummarizeDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ): Promise<SummarizeResponseDto> {
    // The body may name a tenant, but it is a request like any header: a bound
    // credential still cannot reach outside its own tenant.
    const tenantId = this.resolveTenant(principal, body.tenantId || tenantHeader);
    const libraryIds = resolveRequestLibraryIds(
      principal,
      body.libraryId ? [body.libraryId] : undefined,
      libraryHeader,
    );
    
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
    @Headers('x-tenant-id') tenantHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ): Promise<any> {
    // Session ids are opaque, but without this filter any credential could read
    // another tenant's conversation just by holding one.
    const tenantId = this.resolveTenant(principal, tenantHeader);
    return this.chatHistory.getBySessionId(sessionId, tenantId);
  }

  private resolveTenant(principal: ApiPrincipal | undefined, tenantHeader?: string): string | undefined {
    return resolveRequestTenant(
      principal,
      tenantHeader,
      this.configService.get('app.enableMultiTenant', { infer: true }) ?? false,
    );
  }

}
