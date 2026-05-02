import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { int } from 'neo4j-driver';
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
      await session.run('CREATE INDEX chat_message_tenant IF NOT EXISTS FOR (m:ChatMessage) ON (m.tenantId)');
      await session.run('CREATE INDEX chat_message_library IF NOT EXISTS FOR (m:ChatMessage) ON (m.libraryId)');
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
          tenantId: $tenantId,
          libraryId: $libraryId,
          role: $role,
          content: $content,
          createdAt: $createdAt,
          metadataJson: $metadataJson
        })
        `,
        {
          sessionId: message.sessionId,
          tenantId: message.tenantId ?? null,
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
          tenantId: node.tenantId == null ? undefined : String(node.tenantId),
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

  async countQueries(tenantId?: string, libraryId?: string): Promise<number> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (m:ChatMessage)
        WHERE m.role = 'user'
          AND ($tenantId IS NULL OR m.tenantId = $tenantId)
          AND ($libraryId IS NULL OR m.libraryId = $libraryId)
        RETURN count(*) AS total
        `,
        { tenantId: tenantId ?? null, libraryId: libraryId ?? null },
      );
      return this.asNumber(result.records[0]?.get('total'));
    } finally {
      await session.close();
    }
  }

  async getQueryCountByDay(
    days: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ date: string; count: number }>> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        WITH date() - duration({days: $days - 1}) AS startDate
        MATCH (m:ChatMessage)
        WHERE m.role = 'user'
          AND ($tenantId IS NULL OR m.tenantId = $tenantId)
          AND ($libraryId IS NULL OR m.libraryId = $libraryId)
          AND m.createdAt IS NOT NULL
        WITH date(m.createdAt) AS day, startDate
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

  async getTopLibrariesByQueryCount(
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ libraryId: string; count: number }>> {
    const session = this.neo4j.getSession();
    try {
      const result = await session.run(
        `
        MATCH (m:ChatMessage)
        WHERE m.role = 'user'
          AND ($tenantId IS NULL OR m.tenantId = $tenantId)
          AND ($libraryId IS NULL OR m.libraryId = $libraryId)
          AND m.libraryId IS NOT NULL
          AND trim(m.libraryId) <> ''
        RETURN m.libraryId AS libraryId, count(*) AS count
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

  private asNumber(value: unknown): number {
    if (typeof (value as { toNumber?: unknown })?.toNumber === 'function') {
      return Number((value as { toNumber: () => number }).toNumber());
    }
    return Number(value ?? 0);
  }
}
