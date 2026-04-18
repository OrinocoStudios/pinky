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

  async listDocuments(limit = 50, libraryId?: string): Promise<DocumentRecord[]> {
    return this.listDocumentsByScope(limit, undefined, libraryId);
  }

  async listDocumentsByTenant(
    tenantId: string,
    limit = 50,
    libraryId?: string,
  ): Promise<DocumentRecord[]> {
    return this.listDocumentsByScope(limit, tenantId, libraryId);
  }

  async listDocumentsByLibrary(
    libraryId: string,
    tenantId?: string,
    limit = 50,
  ): Promise<DocumentRecord[]> {
    return this.listDocumentsByScope(limit, tenantId, libraryId);
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
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (d:Document)
        WHERE ($tenantId IS NULL OR d.tenantId = $tenantId)
          AND ($libraryId IS NULL OR d.libraryId = $libraryId)
        RETURN d
        ORDER BY d.createdAt DESC
        LIMIT $limit
        `,
        { tenantId: tenantId ?? null, libraryId: libraryId ?? null, limit: int(limit) },
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
