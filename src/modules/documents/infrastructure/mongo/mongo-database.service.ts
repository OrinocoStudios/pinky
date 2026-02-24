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

  private getDb() {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB connection is not initialized');
    }
    return mongoose.connection.db;
  }
}
