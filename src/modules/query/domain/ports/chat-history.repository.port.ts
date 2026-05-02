export type ChatMessage = {
  sessionId: string;
  tenantId?: string;
  libraryId?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  metadata?: Record<string, any>;
};

export interface ChatHistoryRepositoryPort {
  saveMessage(message: Omit<ChatMessage, 'createdAt'>): Promise<ChatMessage>;
  getBySessionId(sessionId: string): Promise<ChatMessage[]>;
  countQueries(tenantId?: string, libraryId?: string): Promise<number>;
  getQueryCountByDay(
    days: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ date: string; count: number }>>;
  getTopLibrariesByQueryCount(
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ libraryId: string; count: number }>>;
  clearSession(sessionId: string): Promise<void>;
}
