import { Injectable, Logger } from '@nestjs/common';
import { ChatHistoryRepositoryPort, ChatMessage } from '../../domain/ports/chat-history.repository.port';
import { MongoDatabaseService } from '../../../documents/infrastructure/mongo/mongo-database.service';

@Injectable()
export class MongoChatHistoryRepository implements ChatHistoryRepositoryPort {
  private readonly logger = new Logger(MongoChatHistoryRepository.name);

  constructor(private readonly mongoService: MongoDatabaseService) {}

  async saveMessage(message: Omit<ChatMessage, 'createdAt'>): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      ...message,
      createdAt: new Date(),
    };

    try {
      await this.mongoService.chatHistoryCollection.insertOne(newMessage);
      return newMessage;
    } catch (error) {
      this.logger.error(`Failed to save chat message for session ${message.sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getBySessionId(sessionId: string): Promise<ChatMessage[]> {
    try {
      const messages = await this.mongoService.chatHistoryCollection
        .find({ sessionId })
        .sort({ createdAt: 1 })
        .toArray();

      return messages.map((m: any) => ({
        sessionId: m.sessionId,
        libraryId: m.libraryId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        metadata: m.metadata,
      })) as ChatMessage[];
    } catch (error) {
      this.logger.error(`Failed to retrieve chat history for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    try {
      await this.mongoService.chatHistoryCollection.deleteMany({ sessionId });
    } catch (error) {
      this.logger.error(`Failed to clear chat history for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
