import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoDatabaseService } from '../documents/infrastructure/mongo/mongo-database.service';
import { GraphStorePort } from '../graph/domain/ports/graph-store.port';
import { GRAPH_STORE_PORT } from '../../shared/di.tokens';
import { BrainConfig } from '../../config/configuration';

@Controller()
export class HealthController {
  constructor(
    private readonly mongoDb: MongoDatabaseService,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Get('health')
  async health() {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const uptime = Math.floor(process.uptime());

    const services: Record<string, { status: string; latency_ms?: number }> = {};

    try {
      const mongoLatency = await this.mongoDb.ping();
      services.mongodb = { status: 'up', latency_ms: mongoLatency };
    } catch {
      services.mongodb = { status: 'down' };
    }

    try {
      const neoStart = Date.now();
      await this.graphStore.ping();
      services.neo4j = { status: 'up', latency_ms: Date.now() - neoStart };
    } catch {
      services.neo4j = { status: 'down' };
    }

    const llmProvider = this.configService.get('llm.provider', { infer: true });
    (services as Record<string, unknown>).llm = {
      status: llmProvider ? 'configured' : 'unknown',
      provider: llmProvider ?? 'none',
    };

    const allUp =
      services.mongodb?.status === 'up' && services.neo4j?.status === 'up';
    const status = allUp ? 'ok' : 'degraded';

    return {
      status,
      timestamp,
      uptime,
      services,
      service: 'brain-service',
      latency_ms: Date.now() - startTime,
    };
  }
}
