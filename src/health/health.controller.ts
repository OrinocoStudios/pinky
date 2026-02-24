import { Controller, Get } from '@nestjs/common';
import { Neo4jGraphStoreAdapter } from '../modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter';
import { MongoDatabaseService } from '../modules/documents/infrastructure/mongo/mongo-database.service';
import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../config/configuration';

@Controller()
export class HealthController {
  constructor(
    private readonly mongo: MongoDatabaseService,
    private readonly neo4j: Neo4jGraphStoreAdapter,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Get('health')
  async check() {
    const llmProvider = this.configService.get('llm.provider', { infer: true }) ?? 'local';

    let mongoStatus: 'up' | 'down' = 'down';
    let neo4jStatus: 'up' | 'down' = 'down';

    try {
      await this.mongo.ping();
      mongoStatus = 'up';
    } catch {
      mongoStatus = 'down';
    }

    try {
      await this.neo4j.ping();
      neo4jStatus = 'up';
    } catch {
      neo4jStatus = 'down';
    }

    return {
      status: mongoStatus === 'up' && neo4jStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'brain-service',
      version: '0.2.0',
      services: {
        mongodb: { status: mongoStatus },
        neo4j: { status: neo4jStatus },
        llm: { provider: llmProvider, status: 'configured' },
      },
    };
  }
}
