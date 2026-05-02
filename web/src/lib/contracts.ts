export type AuthUser = {
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'google' | 'github';
  providerUserId: string;
  isAdmin: boolean;
};

export type AuthProvidersResponse = {
  providers: string[];
  devLogin: boolean;
};

export type AuthMeResponse = {
  user: AuthUser;
};

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

export type DocumentRecord = {
  documentId: string;
  title?: string;
  status: string;
  graphSyncStatus: string;
  previewText?: string;
  rawText?: string;
  source?: DocumentSource;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  libraryId?: string;
  metadata?: Record<string, unknown>;
};

export type DocumentsPageResponse = {
  items: DocumentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type OverviewResponse = {
  health: {
    status: string;
    uptime: number;
    services: {
      neo4j: { status: string; latency_ms?: number };
      llm: { status: string; provider: string };
    };
    latency_ms: number;
  };
  documents: {
    total: number;
    byStatus: Record<string, number>;
    recent: Array<{
      documentId: string;
      title?: string;
      status: string;
      graphSyncStatus: string;
      updatedAt: string;
      libraryId?: string;
    }>;
  };
  usage: {
    documents: {
      ingestedByDay: Array<{ date: string; count: number }>;
      byLibrary: Array<{ libraryId: string; count: number }>;
      bySource: Array<{ source: string; count: number }>;
    };
    queries: {
      total: number;
      byDay: Array<{ date: string; count: number }>;
      byLibrary: Array<{ libraryId: string; count: number }>;
    };
  };
};

export type HealthResponse = {
  status: string;
  timestamp: string;
  uptime: number;
  services: Record<string, { status: string; latency_ms?: number; provider?: string }>;
  service: string;
  latency_ms: number;
};

export type QueryResponse = {
  answer: string;
  sourcesUsed: Array<{ id?: string; title?: string; documentId?: string }>;
  model: string;
  tokensUsed: number;
  prompt?: string;
  fastContext?: unknown;
  truthFacts?: unknown;
};

export type QueryPayload = {
  query: string;
  sessionId?: string;
  topK?: number;
  entityHints?: string[];
  libraryIds?: string[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type ChatHistoryResponse = {
  sessionId: string;
  messages: ChatMessage[];
};


export type IngestTextDocumentPayload = {
  title?: string;
  rawText: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  libraryId?: string;
};

export type DocumentScopesResponse = {
  tenants: string[];
  libraries: string[];
};

export type GenerateDocumentPayload = {
  useCaseId: string;
  title?: string;
  params?: Record<string, unknown>;
};

export type UploadDocumentPayload = {
  file: File;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type DeleteDocumentResponse = {
  deleted: string;
};

export type ReindexResponse = {
  processed: number;
  failed: number;
  embeddingModel: string;
};
