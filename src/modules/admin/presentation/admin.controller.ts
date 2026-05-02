import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { BrainConfig } from '../../../config/configuration';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { DocumentRecord } from '../../documents/domain/models/document.model';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { ChatHistoryRepositoryPort } from '../../query/domain/ports/chat-history.repository.port';
import { CHAT_HISTORY_REPOSITORY, DOCUMENT_REPOSITORY, GRAPH_STORE_PORT } from '../../../shared/di.tokens';

const USAGE_DAYS = 14;
const TOP_LIBRARY_LIMIT = 5;

@Controller('admin')
export class AdminController {
  constructor(
    private readonly configService: ConfigService<BrainConfig>,
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(CHAT_HISTORY_REPOSITORY)
    private readonly chatHistoryRepository: ChatHistoryRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
  ) {}

  @Get('overview')
  @RequireApiKey()
  async overview(
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    const startedAt = Date.now();

    let neo4j: { status: 'up' | 'down'; latency_ms?: number } = { status: 'down' };
    try {
      const pingStart = Date.now();
      await this.graphStore.ping();
      neo4j = { status: 'up', latency_ms: Date.now() - pingStart };
    } catch {
      neo4j = { status: 'down' };
    }

    const [
      totalDocuments,
      documents,
      documentIngestedByDay,
      documentsByLibrary,
      documentsBySource,
      totalQueries,
      queriesByDay,
      queriesByLibrary,
    ] = await Promise.all([
      this.documentRepository.countDocuments(tenantId, libraryId),
      this.listScopedDocuments(tenantId, libraryId),
      this.documentRepository.getDocumentIngestionByDay(USAGE_DAYS, tenantId, libraryId),
      this.documentRepository.getTopLibrariesByDocumentCount(TOP_LIBRARY_LIMIT, tenantId, libraryId),
      this.documentRepository.getDocumentCountBySource(tenantId, libraryId),
      this.chatHistoryRepository.countQueries(tenantId, libraryId),
      this.chatHistoryRepository.getQueryCountByDay(USAGE_DAYS, tenantId, libraryId),
      this.chatHistoryRepository.getTopLibrariesByQueryCount(TOP_LIBRARY_LIMIT, tenantId, libraryId),
    ]);

    return {
      health: {
        status: neo4j.status === 'up' ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        services: {
          neo4j,
          llm: {
            status: this.configService.get('llm.provider', { infer: true }) ? 'configured' : 'unknown',
            provider: this.configService.get('llm.provider', { infer: true }) ?? 'none',
          },
        },
        latency_ms: Date.now() - startedAt,
      },
      documents: {
        total: totalDocuments,
        byStatus: this.countByStatus(documents),
        recent: documents.slice(0, 10),
      },
      usage: {
        documents: {
          ingestedByDay: this.fillDateSeries(USAGE_DAYS, documentIngestedByDay),
          byLibrary: documentsByLibrary,
          bySource: documentsBySource,
        },
        queries: {
          total: totalQueries,
          byDay: this.fillDateSeries(USAGE_DAYS, queriesByDay),
          byLibrary: queriesByLibrary,
        },
      },
    };
  }

  private async listScopedDocuments(tenantId?: string, libraryId?: string): Promise<DocumentRecord[]> {
    if (tenantId) {
      return this.documentRepository.listDocumentsByTenant(tenantId, 200, libraryId);
    }
    if (libraryId) {
      return this.documentRepository.listDocumentsByLibrary(libraryId, undefined, 200);
    }
    return this.documentRepository.listDocuments(200, libraryId);
  }

  private countByStatus(documents: DocumentRecord[]) {
    return documents.reduce<Record<string, number>>((accumulator, document) => {
      accumulator[document.status] = (accumulator[document.status] ?? 0) + 1;
      return accumulator;
    }, {});
  }

  private fillDateSeries(days: number, source: Array<{ date: string; count: number }>): Array<{ date: string; count: number }> {
    const normalized = new Map(source.map((entry) => [entry.date, entry.count]));
    const dateSeries: Array<{ date: string; count: number }> = [];
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    for (let index = 0; index < days; index += 1) {
      const current = new Date(startDate);
      current.setUTCDate(startDate.getUTCDate() + index);
      const date = current.toISOString().slice(0, 10);
      dateSeries.push({
        date,
        count: normalized.get(date) ?? 0,
      });
    }
    return dateSeries;
  }

  private resolveTenantId(rawTenantId?: string): string | undefined {
    const enableMultiTenant = this.configService.get('app.enableMultiTenant', { infer: true }) ?? false;
    const tenantId = rawTenantId?.trim();
    if (enableMultiTenant && !tenantId) {
      throw new Error('X-Tenant-Id header is required when ENABLE_MULTI_TENANT=true');
    }
    return tenantId;
  }

  private resolveLibraryId(rawLibraryId?: string): string | undefined {
    const libraryId = rawLibraryId?.trim();
    return libraryId && libraryId.length > 0 ? libraryId : undefined;
  }
}
