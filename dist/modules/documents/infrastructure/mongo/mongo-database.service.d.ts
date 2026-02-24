import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import { BrainConfig } from '../../../../config/configuration';
export declare class MongoDatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    constructor(configService: ConfigService<BrainConfig>);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get documentsCollection(): mongoose.mongo.Collection<mongoose.mongo.BSON.Document>;
    get chunksCollection(): mongoose.mongo.Collection<mongoose.mongo.BSON.Document>;
    get graphSyncOutboxCollection(): mongoose.mongo.Collection<mongoose.mongo.BSON.Document>;
    private getDb;
}
