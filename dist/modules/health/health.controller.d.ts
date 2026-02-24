import { ConfigService } from '@nestjs/config';
import { MongoDatabaseService } from '../documents/infrastructure/mongo/mongo-database.service';
import { GraphStorePort } from '../graph/domain/ports/graph-store.port';
import { BrainConfig } from '../../config/configuration';
export declare class HealthController {
    private readonly mongoDb;
    private readonly graphStore;
    private readonly configService;
    constructor(mongoDb: MongoDatabaseService, graphStore: GraphStorePort, configService: ConfigService<BrainConfig>);
    health(): Promise<{
        status: string;
        timestamp: string;
        uptime: number;
        services: Record<string, {
            status: string;
            latency_ms?: number;
        }>;
        service: string;
        latency_ms: number;
    }>;
}
