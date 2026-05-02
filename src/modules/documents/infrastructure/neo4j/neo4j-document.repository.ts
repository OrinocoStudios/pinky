import { Injectable, OnModuleInit } from '@nestjs/common';
import { int } from 'neo4j-driver';
import { DocumentChunk, DocumentRecord } from '../../domain/models/document.model';
import { DocumentRepositoryPort } from '../../domain/ports/document-repository.port';
import { Neo4jConnectionService } from '../../../graph/infrastructure/neo4j/neo4j-connection.service';

@Injectable()
export class Neo4jDocumentRepository implements DocumentRepositoryPort, OnModuleInit {
  constructor(private readonly neo4j: Neo4jConnectionService) {}

  async onModuleInit(): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run(
        'CREATE CONSTRAINT document_document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.documentId IS UNIQUE',
      );
      await session.run(
        'CREATE CONSTRAINT document_ingest_key IF NOT EXISTS FOR (d:Document) REQUIRE d.ingestKey IS UNIQUE',
      );
      await session.run(
        'CREATE CONSTRAINT chunk_chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.chunkId IS UNIQUE',
      );
      await session.run('CREATE INDEX document_checksum IF NOT EXISTS FOR (d:Document) ON (d.checksum)');
      await session.run('CREATE INDEX document_tenant_id IF NOT EXISTS FOR (d:Document) ON (d.tenantId)');
      await session.run('CREATE INDEX document_library_id IF NOT EXISTS FOR (d:Document) ON (d.libraryId)');
      await session.run('CREATE INDEX chunk_tenant_id IF NOT EXISTS FOR (c:Chunk) ON (c.tenantId)');
      await session.run('CREATE INDEX chunk_library_id IF NOT EXISTS FOR (c:Chunk) ON (c.libraryId)');
    } finally {
      await session.close();
    }
  }

  async createDocument(input: Omit<DocumentRecord, 'createdAt' | 'updatedAt'>): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    const document: DocumentRecord = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    const session = this.neo4j.getSession();
    try {
      await session.run(
        `
        CREATE (d:Document {
          documentId: $documentId,
          ingestKey: $ingestKey,
          tenantId: $tenantId,
          libraryId: $libraryId,
          title: $title,
          checksum: $checksum,
          rawText: $rawText,
          language: $language,
          status: $status,
          graphSyncStatus: $graphSyncStatus,
          tags: $tags,
          sourceJson: $sourceJson,
          metadataJson: $metadataJson,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
        `,
        this.toDocumentParams(document),
      );
      return document;
    } finally {
      await session.close();
    }
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentRecord['status'],
    graphSyncStatus?: DocumentRecord['graphSyncStatus'],
  ): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run(
        `
        MATCH (d:Document {documentId: $documentId})
        SET d.status = $status,
            d.updatedAt = $updatedAt,
            d.graphSyncStatus = CASE
              WHEN $graphSyncStatus IS NULL THEN d.graphSyncStatus
              ELSE $graphSyncStatus
            END
        `,
        {
          documentId,
          status,
          graphSyncStatus: graphSyncStatus ?? null,
          updatedAt: new Date().toISOString(),
        },
      );
    } finally {
      await session.close();
    }
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const session = this.neo4j.getSession();
    try {
      for (const chunk of chunks) {
        await session.run(
          `
          MERGE (c:Chunk {chunkId: $chunkId})
          SET c.documentId = $documentId,
              c.tenantId = $tenantId,
              c.libraryId = $libraryId,
              c.seq = $seq,
              c.text = $text,
              c.embedding = $embedding,
              c.embeddingModel = $embeddingModel,
              c.tokenCount = $tokenCount,
              c.startOffset = $startOffset,
              c.endOffset = $endOffset,
              c.createdAt = $createdAt
          WITH c
          MATCH (d:Document {documentId: $documentId})
          MERGE (d)-[:HAS_CHUNK]->(c)
          `,
          this.toChunkParams(chunk),
        );
      }
    } finally {
      await session.close();
    }
  }

  async listAllChunks(limit = 10000, tenantId?: string, libraryId?: string): Promise<DocumentChunk[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Chunk)
        WHERE ($tenantId IS NULL OR c.tenantId = $tenantId)
          AND ($libraryId IS NULL OR c.libraryId = $libraryId)
        RETURN c
        ORDER BY c.createdAt ASC, c.seq ASC
        LIMIT $limit
        `,
        { tenantId: tenantId ?? null, libraryId: libraryId ?? null, limit: int(limit) },
      );
      return result.records.map((record) => this.mapChunkNode(record.get('c').properties));
    } finally {
      await session.close();
    }
  }

  async listChunksNeedingReindex(
    currentEmbeddingModel: string,
    limit = 10000,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentChunk[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Chunk)
        WHERE ($tenantId IS NULL OR c.tenantId = $tenantId)
          AND ($libraryId IS NULL OR c.libraryId = $libraryId)
          AND (c.embeddingModel IS NULL OR c.embeddingModel <> $embeddingModel)
        RETURN c
        ORDER BY c.createdAt ASC, c.seq ASC
        LIMIT $limit
        `,
        {
          tenantId: tenantId ?? null,
          libraryId: libraryId ?? null,
          embeddingModel: currentEmbeddingModel,
          limit: int(limit),
        },
      );
      return result.records.map((record) => this.mapChunkNode(record.get('c').properties));
    } finally {
      await session.close();
    }
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[], embeddingModel: string): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run(
        `
        MATCH (c:Chunk {chunkId: $chunkId})
        SET c.embedding = $embedding,
            c.embeddingModel = $embeddingModel
        `,
        { chunkId, embedding, embeddingModel },
      );
    } finally {
      await session.close();
    }
  }

  async listDocuments(limit?: number, libraryId?: string, offset?: number): Promise<DocumentRecord[]> {
    return this.listDocumentsByScope(limit, undefined, libraryId, offset);
  }

  async listDocumentsByTenant(
    tenantId: string,
    limit?: number,
    libraryId?: string,
    offset?: number,
  ): Promise<DocumentRecord[]> {
    return this.listDocumentsByScope(limit, tenantId, libraryId, offset);
  }

  async listDocumentsByLibrary(
    libraryId: string,
    tenantId?: string,
    limit?: number,
    offset?: number,
  ): Promise<DocumentRecord[]> {
    return this.listDocumentsByScope(limit, tenantId, libraryId, offset);
  }

  async countDocuments(tenantId?: string, libraryId?: string): Promise<number> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document)
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
        RETURN count(d) AS total
        `,
        { tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
      const total = result.records[0]?.get('total');
      return this.asNumber(total);
    } finally {
      await session.close();
    }
  }

  async getDocumentIngestionByDay(
    days: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ date: string; count: number }>> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        WITH date() - duration({days: $days - 1}) AS startDate
        MATCH (d:Document)
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
          AND d.createdAt IS NOT NULL
        WITH date(d.createdAt) AS day, startDate
        WHERE day >= startDate
        RETURN toString(day) AS date, count(*) AS count
        ORDER BY day ASC
        `,
        {
          days: int(Math.max(days, 1)),
          tenantId: tenantId ?? null,
          libraryId: libraryId ?? null,
        },
      );
      return result.records.map((record) => ({
        date: String(record.get('date')),
        count: this.asNumber(record.get('count')),
      }));
    } finally {
      await session.close();
    }
  }

  async getTopLibrariesByDocumentCount(
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ libraryId: string; count: number }>> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document)
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
          AND d.libraryId IS NOT NULL
          AND trim(d.libraryId) <> ''
        RETURN d.libraryId AS libraryId, count(*) AS count
        ORDER BY count DESC, libraryId ASC
        LIMIT $limit
        `,
        {
          tenantId: tenantId ?? null,
          libraryId: libraryId ?? null,
          limit: int(Math.max(limit, 1)),
        },
      );
      return result.records.map((record) => ({
        libraryId: String(record.get('libraryId')),
        count: this.asNumber(record.get('count')),
      }));
    } finally {
      await session.close();
    }
  }

  async getDocumentCountBySource(
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ source: string; count: number }>> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document)
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
        WITH CASE
          WHEN d.sourceJson CONTAINS '"kind":"upload"' THEN 'upload'
          WHEN d.sourceJson CONTAINS '"kind":"url"' THEN 'url'
          WHEN d.sourceJson CONTAINS '"kind":"generated"' THEN 'generated'
          ELSE 'unknown'
        END AS source
        RETURN source, count(*) AS count
        ORDER BY count DESC, source ASC
        `,
        { tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
      return result.records.map((record) => ({
        source: String(record.get('source')),
        count: this.asNumber(record.get('count')),
      }));
    } finally {
      await session.close();
    }
  }

  async listDocumentScopes(): Promise<{ tenants: string[]; libraries: string[] }> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document)
        WITH collect(DISTINCT d.tenantId) AS tenantValues, collect(DISTINCT d.libraryId) AS libraryValues
        RETURN
          [tenant IN tenantValues WHERE tenant IS NOT NULL AND trim(tenant) <> ''] AS tenants,
          [library IN libraryValues WHERE library IS NOT NULL AND trim(library) <> ''] AS libraries
        `,
      );
      const record = result.records[0];
      const tenantValues = record?.get('tenants');
      const libraryValues = record?.get('libraries');
      const tenants: string[] = Array.isArray(tenantValues)
        ? tenantValues.map((value: unknown) => String(value))
        : [];
      const libraries: string[] = Array.isArray(libraryValues)
        ? libraryValues.map((value: unknown) => String(value))
        : [];
      return {
        tenants: [...new Set(tenants)].sort((a, b) => a.localeCompare(b)),
        libraries: [...new Set(libraries)].sort((a, b) => a.localeCompare(b)),
      };
    } finally {
      await session.close();
    }
  }

  async findDocumentById(documentId: string): Promise<DocumentRecord | null> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        'MATCH (d:Document {documentId: $documentId}) RETURN d LIMIT 1',
        { documentId },
      );
      const record = result.records[0];
      return record ? this.mapDocumentNode(record.get('d').properties) : null;
    } finally {
      await session.close();
    }
  }

  async findDocumentByChecksum(
    checksum: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord | null> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document {checksum: $checksum})
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
        RETURN d
        LIMIT 1
        `,
        { checksum, tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
      const record = result.records[0];
      return record ? this.mapDocumentNode(record.get('d').properties) : null;
    } finally {
      await session.close();
    }
  }

  async findDocumentByIngestKey(
    ingestKey: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord | null> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document {ingestKey: $ingestKey})
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
        RETURN d
        LIMIT 1
        `,
        { ingestKey, tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
      const record = result.records[0];
      return record ? this.mapDocumentNode(record.get('d').properties) : null;
    } finally {
      await session.close();
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run(
        `
        MATCH (d:Document {documentId: $documentId})-[r:HAS_CHUNK]->(c:Chunk)
        DETACH DELETE c
        `,
        { documentId },
      );
      await session.run(
        'MATCH (d:Document {documentId: $documentId}) DETACH DELETE d',
        { documentId },
      );
    } finally {
      await session.close();
    }
  }

  private async listDocumentsByScope(
    limit?: number,
    tenantId?: string,
    libraryId?: string,
    offset = 0,
  ): Promise<DocumentRecord[]> {
    const session = this.neo4j.getSession();
    const hasLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0;
    const limitClause = hasLimit ? 'LIMIT $limit' : '';
    const hasOffset = Number.isFinite(offset) && offset > 0;
    const skipClause = hasOffset ? 'SKIP $offset' : '';
    try {
      const result = await session.run(
        `
        MATCH (d:Document)
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
        RETURN d
        ORDER BY d.createdAt DESC
        ${skipClause}
        ${limitClause}
        `,
        {
          tenantId: tenantId ?? null,
          libraryId: libraryId ?? null,
          ...(hasOffset ? { offset: int(offset) } : {}),
          ...(hasLimit ? { limit: int(limit as number) } : {}),
        },
      );
      return result.records.map((record) => this.mapDocumentNode(record.get('d').properties));
    } finally {
      await session.close();
    }
  }

  private toDocumentParams(document: DocumentRecord) {
    return {
      documentId: document.documentId,
      ingestKey: document.ingestKey ?? null,
      tenantId: document.tenantId ?? null,
      libraryId: document.libraryId ?? null,
      title: document.title ?? null,
      checksum: document.checksum ?? null,
      rawText: document.rawText ?? null,
      language: document.language ?? null,
      status: document.status,
      graphSyncStatus: document.graphSyncStatus,
      tags: document.tags ?? [],
      sourceJson: JSON.stringify(document.source),
      metadataJson: JSON.stringify(document.metadata ?? {}),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private toChunkParams(chunk: DocumentChunk) {
    return {
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      tenantId: chunk.tenantId ?? null,
      libraryId: chunk.libraryId ?? null,
      seq: chunk.seq,
      text: chunk.text,
      embedding: chunk.embedding ?? null,
      embeddingModel: chunk.embeddingModel ?? null,
      tokenCount: chunk.tokenCount ?? null,
      startOffset: chunk.startOffset ?? null,
      endOffset: chunk.endOffset ?? null,
      createdAt: chunk.createdAt,
    };
  }

  private mapDocumentNode(node: Record<string, unknown>): DocumentRecord {
    return {
      documentId: String(node.documentId),
      ingestKey: this.asOptionalString(node.ingestKey),
      tenantId: this.asOptionalString(node.tenantId),
      libraryId: this.asOptionalString(node.libraryId),
      title: this.asOptionalString(node.title),
      source: this.parseJson(node.sourceJson, { kind: 'generated', useCaseId: 'unknown' }),
      checksum: this.asOptionalString(node.checksum),
      rawText: this.asOptionalString(node.rawText),
      language: this.asOptionalString(node.language),
      status: String(node.status) as DocumentRecord['status'],
      graphSyncStatus: String(node.graphSyncStatus) as DocumentRecord['graphSyncStatus'],
      tags: Array.isArray(node.tags) ? node.tags.map((tag) => String(tag)) : undefined,
      metadata: this.parseJson<Record<string, unknown>>(node.metadataJson, {}),
      createdAt: this.asOptionalString(node.createdAt) ?? new Date().toISOString(),
      updatedAt: this.asOptionalString(node.updatedAt) ?? new Date().toISOString(),
    };
  }

  private mapChunkNode(node: Record<string, unknown>): DocumentChunk {
    return {
      chunkId: String(node.chunkId),
      documentId: String(node.documentId),
      tenantId: this.asOptionalString(node.tenantId),
      libraryId: this.asOptionalString(node.libraryId),
      seq: this.asNumber(node.seq),
      text: this.asOptionalString(node.text) ?? '',
      embedding: Array.isArray(node.embedding)
        ? node.embedding.map((value) => Number(value))
        : undefined,
      embeddingModel: this.asOptionalString(node.embeddingModel),
      tokenCount: node.tokenCount == null ? undefined : this.asNumber(node.tokenCount),
      startOffset: node.startOffset == null ? undefined : this.asNumber(node.startOffset),
      endOffset: node.endOffset == null ? undefined : this.asNumber(node.endOffset),
      createdAt: this.asOptionalString(node.createdAt) ?? new Date().toISOString(),
    };
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string' || value.trim() === '') {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private asOptionalString(value: unknown): string | undefined {
    return value == null ? undefined : String(value);
  }

  private asNumber(value: unknown): number {
    if (typeof (value as { toNumber?: unknown })?.toNumber === 'function') {
      return Number((value as { toNumber: () => number }).toNumber());
    }

    return Number(value ?? 0);
  }
}
