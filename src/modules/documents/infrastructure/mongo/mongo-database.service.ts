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

    await db.collection('documents').createIndex({ documentId: 1 }, { unique: true });
    await db.collection('documents').createIndex({ checksum: 1 }, { sparse: true });
    await db.collection('documents').createIndex(
      { tenantId: 1, checksum: 1 },
      { sparse: true, unique: true },
    );
    await db.collection('documents').createIndex({ tenantId: 1, createdAt: -1 });

    await db.collection('chunks').createIndex({ chunkId: 1 }, { unique: true });
    await db.collection('chunks').createIndex({ documentId: 1 });
    await db.collection('chunks').createIndex({ tenantId: 1, documentId: 1 });

    await db.collection('graph_sync_outbox').createIndex(
      { status: 1, attempts: 1, updatedAt: 1 },
    );
    await db.collection('graph_sync_outbox').createIndex({ documentId: 1 });
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

  get graphSyncOutboxCollection() {
    return this.getDb().collection('graph_sync_outbox');
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
}
