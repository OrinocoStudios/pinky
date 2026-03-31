export type ChatMessage = {
  sessionId: string;
  libraryId?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  metadata?: Record<string, any>;
};

export interface ChatHistoryRepositoryPort {
  saveMessage(message: Omit<ChatMessage, 'createdAt'>): Promise<ChatMessage>;
  getBySessionId(sessionId: string): Promise<ChatMessage[]>;
  clearSession(sessionId: string): Promise<void>;
}
