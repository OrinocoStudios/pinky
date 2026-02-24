export type DocumentStatus = 'RECEIVED' | 'STORED' | 'TEXT_EXTRACTED' | 'CHUNKED' | 'EMBEDDED' | 'GRAPH_EXTRACTED' | 'READY' | 'ERROR';
export type GraphSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type DocumentSource = {
    kind: 'upload';
    filename: string;
    mimeType: string;
} | {
    kind: 'url';
    url: string;
} | {
    kind: 'generated';
    useCaseId: string;
};
export interface DocumentRecord {
    documentId: string;
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
    payload: string;
    status: OutboxEventStatus;
    attempts: number;
    lastError?: string;
    lockExpiresAt?: string;
    createdAt: string;
    updatedAt: string;
    claimedAt?: string;
    claimedBy?: string;
}
