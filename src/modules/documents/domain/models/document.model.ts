export type DocumentStatus =
  | 'RECEIVED'
  | 'STORED'
  | 'TEXT_EXTRACTED'
  | 'CHUNKED'
  | 'EMBEDDED'
  | 'GRAPH_EXTRACTED'
  | 'READY'
  | 'ERROR';

export type GraphSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export type DocumentSource =
  | {
      kind: 'upload';
      filename: string;
      mimeType: string;
    }
  | {
      kind: 'url';
      url: string;
    }
  | {
      kind: 'generated';
      useCaseId: string;
    };

export interface DocumentRecord {
  documentId: string;
  tenantId?: string;
  title?: string;
  source: DocumentSource;
  checksum?: string;
  rawText?: string;
  language?: string;
  status: DocumentStatus;
  graphSyncStatus: GraphSyncStatus;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  tenantId?: string;
  seq: number;
  text: string;
  embedding?: number[];
  embeddingModel?: string;
  tokenCount?: number;
  startOffset?: number;
  endOffset?: number;
  createdAt: string;
}

export type OutboxEventStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'SYNCED' | 'DEAD_LETTER';

export interface GraphSyncOutboxEvent {
  eventId: string;
  documentId: string;
  tenantId?: string;
  payload: string; // JSON-serialized ExtractedGraph
  status: OutboxEventStatus;
  attempts: number;
  lastError?: string;
  lockExpiresAt?: string; // ISO timestamp, for concurrent claim locking
  createdAt: string;
  updatedAt: string;
  /** Set when event is claimed for processing (atomic locking) */
  claimedAt?: string;
  /** Instance/pod ID that claimed the event */
  claimedBy?: string;
}
