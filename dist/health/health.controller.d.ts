import { Neo4jGraphStoreAdapter } from '../modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter';
import { MongoDatabaseService } from '../modules/documents/infrastructure/mongo/mongo-database.service';
import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../config/configuration';
export declare class HealthController {
    private readonly mongo;
    private readonly neo4j;
    private readonly configService;
    constructor(mongo: MongoDatabaseService, neo4j: Neo4jGraphStoreAdapter, configService: ConfigService<BrainConfig>);
    check(): Promise<{
        status: string;
        timestamp: string;
        uptime: number;
        service: string;
        version: string;
        services: {
            mongodb: {
                status: "up" | "down";
            };
            neo4j: {
                status: "up" | "down";
            };
            llm: {
                provider: "openai" | "anthropic" | "local";
                status: string;
            };
        };
    }>;
}
