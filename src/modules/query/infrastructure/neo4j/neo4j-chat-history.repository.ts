import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Neo4jConnectionService } from '../../../graph/infrastructure/neo4j/neo4j-connection.service';
import { ChatHistoryRepositoryPort, ChatMessage } from '../../domain/ports/chat-history.repository.port';

@Injectable()
export class Neo4jChatHistoryRepository implements ChatHistoryRepositoryPort, OnModuleInit {
  private readonly logger = new Logger(Neo4jChatHistoryRepository.name);

  constructor(private readonly neo4j: Neo4jConnectionService) {}

  async onModuleInit(): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run('CREATE INDEX chat_message_session IF NOT EXISTS FOR (m:ChatMessage) ON (m.sessionId)');
    } finally {
      await session.close();
    }
  }

  async saveMessage(message: Omit<ChatMessage, 'createdAt'>): Promise<ChatMessage> {
    const createdAt = new Date();
    const savedMessage: ChatMessage = { ...message, createdAt };

    const session = this.neo4j.getSession();
    try {
      await session.run(
        `
        CREATE (m:ChatMessage {
          sessionId: $sessionId,
          libraryId: $libraryId,
          role: $role,
          content: $content,
          createdAt: $createdAt,
          metadataJson: $metadataJson
        })
        `,
        {
          sessionId: message.sessionId,
          libraryId: message.libraryId ?? null,
          role: message.role,
          content: message.content,
          createdAt: createdAt.toISOString(),
          metadataJson: JSON.stringify(message.metadata ?? {}),
        },
      );
      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Failed to save chat message for session ${message.sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async getBySessionId(sessionId: string): Promise<ChatMessage[]> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (m:ChatMessage {sessionId: $sessionId})
        RETURN m
        ORDER BY m.createdAt ASC
        `,
        { sessionId },
      );

      return result.records.map((record) => {
        const node = record.get('m').properties as Record<string, unknown>;
        return {
          sessionId: String(node.sessionId),
          libraryId: node.libraryId == null ? undefined : String(node.libraryId),
          role: String(node.role) as ChatMessage['role'],
          content: String(node.content),
          createdAt: new Date(String(node.createdAt)),
          metadata: this.parseJson(node.metadataJson),
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to retrieve chat history for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    const session = this.neo4j.getSession();
    try {
      await session.run('MATCH (m:ChatMessage {sessionId: $sessionId}) DETACH DELETE m', { sessionId });
    } catch (error) {
      this.logger.error(
        `Failed to clear chat history for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  private parseJson(value: unknown): Record<string, any> | undefined {
    if (typeof value !== 'string' || value.trim() === '') {
      return undefined;
    }

    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return undefined;
    }
  }
}
