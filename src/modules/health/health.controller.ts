import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { GraphStorePort } from '../graph/domain/ports/graph-store.port';
import { GRAPH_STORE_PORT } from '../../shared/di.tokens';
import { BrainConfig } from '../../config/configuration';

type ServiceStatus = {
  status: 'up' | 'down' | 'degraded' | 'configured' | 'unknown';
  latency_ms?: number;
  provider?: string;
  message?: string;
};

const LLM_PING_TIMEOUT_MS = 3000;

@Controller()
@SkipThrottle({ query: true, upload: true, ingest: true })
export class HealthController {
  constructor(
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
    private readonly configService: ConfigService<BrainConfig>,
  ) {}

  @Get('health')
  async health() {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const uptime = Math.floor(process.uptime());

    const services: Record<string, ServiceStatus> = {};

    try {
      const neoStart = Date.now();
      await this.graphStore.ping();
      services.neo4j = { status: 'up', latency_ms: Date.now() - neoStart };
    } catch {
      services.neo4j = { status: 'down' };
    }

    services.llm = await this.probeLlm();

    const allUp =
      services.neo4j?.status === 'up' &&
      (services.llm?.status === 'up' || services.llm?.status === 'configured');
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

  private async probeLlm(): Promise<ServiceStatus> {
    const provider = this.configService.get('llm.provider', { infer: true });
    if (!provider) {
      return { status: 'unknown', provider: 'none' };
    }

    if (provider === 'openai') {
      const openai = this.configService.get('llm.openai', { infer: true });
      const baseUrl = openai?.baseUrl;
      if (!baseUrl) {
        return { status: 'configured', provider };
      }
      return this.pingOpenAiCompatible(baseUrl, openai?.apiKey, provider, openai?.extraHeaders);
    }

    if (provider === 'ollama') {
      const ollama = this.configService.get('ollama', { infer: true });
      if (!ollama?.baseUrl) {
        return { status: 'configured', provider };
      }
      return this.pingOllama(ollama.baseUrl, ollama.apiKey, provider);
    }

    return { status: 'configured', provider };
  }

  private async pingOpenAiCompatible(
    baseUrl: string,
    apiKey: string | undefined,
    provider: string,
    // Without these the probe fails with 403 behind an authenticating proxy
    // while the adapters, which do send them, work fine.
    extraHeaders: Record<string, string> = {},
  ): Promise<ServiceStatus> {
    const headers: Record<string, string> = { accept: 'application/json', ...extraHeaders };
    if (apiKey) {
      headers['authorization'] = `Bearer ${apiKey}`;
    }

    return this.timedProbe(provider, async (signal) => {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers,
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    });
  }

  private async pingOllama(
    baseUrl: string,
    apiKey: string | undefined,
    provider: string,
  ): Promise<ServiceStatus> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (apiKey) {
      headers['authorization'] = `Bearer ${apiKey}`;
    }

    return this.timedProbe(provider, async (signal) => {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
        method: 'GET',
        headers,
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    });
  }

  private async timedProbe(
    provider: string,
    run: (signal: AbortSignal) => Promise<void>,
  ): Promise<ServiceStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_PING_TIMEOUT_MS);
    const start = Date.now();
    try {
      await run(controller.signal);
      return { status: 'up', provider, latency_ms: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        provider,
        latency_ms: Date.now() - start,
        message: error instanceof Error ? error.message : 'unknown error',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
