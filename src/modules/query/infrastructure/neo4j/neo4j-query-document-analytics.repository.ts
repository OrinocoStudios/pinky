import { Injectable, OnModuleInit } from '@nestjs/common';
import { int } from 'neo4j-driver';
import { Neo4jConnectionService } from '../../../graph/infrastructure/neo4j/neo4j-connection.service';
import {
  QueryDocumentAnalyticsRepositoryPort,
  SaveRetrievedDocumentsInput,
} from '../../domain/ports/query-document-analytics.repository.port';

@Injectable()
export class Neo4jQueryDocumentAnalyticsRepository
  implements QueryDocumentAnalyticsRepositoryPort, OnModuleInit
{
  constructor(private readonly neo4j: Neo4jConnectionService) {}

  async onModuleInit(): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run(
        'CREATE INDEX query_document_hit_query IF NOT EXISTS FOR (h:QueryDocumentHit) ON (h.queryExecutionId)',
      );
      await session.run(
        'CREATE INDEX query_document_hit_created IF NOT EXISTS FOR (h:QueryDocumentHit) ON (h.createdAt)',
      );
      await session.run(
        'CREATE INDEX query_document_hit_tenant IF NOT EXISTS FOR (h:QueryDocumentHit) ON (h.tenantId)',
      );
      await session.run(
        'CREATE INDEX query_document_hit_library IF NOT EXISTS FOR (h:QueryDocumentHit) ON (h.libraryId)',
      );
      await session.run(
        'CREATE INDEX query_document_hit_document IF NOT EXISTS FOR (h:QueryDocumentHit) ON (h.documentId)',
      );
    } finally {
      await session.close();
    }
  }

  async saveRetrievedDocuments(input: SaveRetrievedDocumentsInput): Promise<void> {
    if (input.documents.length === 0) {
      return;
    }
    const session = this.neo4j.getSession();
    try {
      await session.run(
        `
        UNWIND $documents AS document
        CREATE (h:QueryDocumentHit {
          queryExecutionId: $queryExecutionId,
          tenantId: $tenantId,
          libraryId: coalesce(document.libraryId, $libraryId),
          documentId: document.documentId,
          title: document.title,
          createdAt: $createdAt
        })
        `,
        {
          queryExecutionId: input.queryExecutionId,
          tenantId: input.tenantId ?? null,
          libraryId: input.libraryId ?? null,
          createdAt: input.createdAt,
          documents: input.documents.map((document) => ({
            documentId: document.documentId,
            title: document.title ?? null,
            libraryId: document.libraryId ?? null,
          })),
        },
      );
    } finally {
      await session.close();
    }
  }

  async getTopDocumentsByQueryCount(
    days: number,
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ documentId: string; title?: string; count: number }>> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        WITH date() - duration({days: $days - 1}) AS startDate
        MATCH (h:QueryDocumentHit)
        WHERE ($tenantId IS NULL OR h.tenantId = $tenantId)
          AND ($libraryId IS NULL OR h.libraryId = $libraryId)
          AND h.createdAt IS NOT NULL
        WITH h, date(datetime(h.createdAt)) AS day, startDate
        WHERE day >= startDate
        WITH h.documentId AS documentId, max(h.title) AS title, count(*) AS count
        RETURN documentId, title, count
        ORDER BY count DESC, documentId ASC
        LIMIT $limit
        `,
        {
          tenantId: tenantId ?? null,
          libraryId: libraryId ?? null,
          days: int(Math.max(days, 1)),
          limit: int(Math.max(limit, 1)),
        },
      );

      return result.records.map((record) => ({
        documentId: String(record.get('documentId')),
        title: record.get('title') == null ? undefined : String(record.get('title')),
        count: this.asNumber(record.get('count')),
      }));
    } finally {
      await session.close();
    }
  }

  private asNumber(value: unknown): number {
    if (typeof (value as { toNumber?: unknown })?.toNumber === 'function') {
      return Number((value as { toNumber: () => number }).toNumber());
    }
    return Number(value ?? 0);
  }
}
