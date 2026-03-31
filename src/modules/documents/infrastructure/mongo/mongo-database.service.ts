import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import { BrainConfig } from '../../../../config/configuration';

@Injectable()
export class MongoDatabaseService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService<BrainConfig>) {}

  async onModuleInit(): Promise<void> {
    const uri = this.configService.get<string>('mongo.uri', { infer: true });
    const dbName = this.configService.get<string>('mongo.dbName', { infer: true });
    if (!uri || !dbName) {
      throw new Error('MongoDB config is missing');
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, { dbName });
    }

    await this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    const db = this.getDb();
    const documents = db.collection('documents');
    const chunks = db.collection('chunks');
    const chatHistory = db.collection('chat_history');

    await this.dropIndexIfExists(documents, 'tenantId_1_checksum_1');
    await documents.createIndex({ documentId: 1 }, { unique: true });
    await documents.createIndex({ checksum: 1 }, { sparse: true });
    await documents.createIndex(
      { tenantId: 1, libraryId: 1, checksum: 1 },
      {
        unique: true,
        partialFilterExpression: { checksum: { $exists: true } },
      },
    );
    await documents.createIndex({ tenantId: 1, createdAt: -1 });
    await documents.createIndex({ tenantId: 1, libraryId: 1, createdAt: -1 });
    await documents.createIndex({ libraryId: 1, createdAt: -1 });

    await chunks.createIndex({ chunkId: 1 }, { unique: true });
    await chunks.createIndex({ documentId: 1 });
    await chunks.createIndex({ tenantId: 1, documentId: 1 });
    await chunks.createIndex({ tenantId: 1, libraryId: 1, documentId: 1 });
    await chunks.createIndex({ libraryId: 1, documentId: 1 });

    await chatHistory.createIndex({ sessionId: 1 });
    await chatHistory.createIndex({ libraryId: 1, createdAt: -1 });
  }

  async onModuleDestroy(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  get documentsCollection() {
    return this.getDb().collection('documents');
  }

  get chunksCollection() {
    return this.getDb().collection('chunks');
  }

  get chatHistoryCollection() {
    return this.getDb().collection('chat_history');
  }

  async ping(): Promise<number> {
    const start = Date.now();
    await this.getDb().command({ ping: 1 });
    return Date.now() - start;
  }

  private getDb() {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB connection is not initialized');
    }
    return mongoose.connection.db;
  }

  private async dropIndexIfExists(
    collection: any,
    indexName: string,
  ): Promise<void> {
    try {
      if (await collection.indexExists(indexName)) {
        await collection.dropIndex(indexName);
      }
    } catch (error: any) {
      if (error.codeName === 'NamespaceNotFound' || error.code === 26) {
        return;
      }
      throw error;
    }
  }
}
