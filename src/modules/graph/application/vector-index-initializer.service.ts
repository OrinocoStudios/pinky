import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { EMBEDDING_PORT, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { EmbeddingPort } from '../../ingestion/domain/ports/embedding.port';
import { GraphStorePort } from '../domain/ports/graph-store.port';

const INITIAL_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Ensures the Neo4j vector index exists by probing the embedding gateway for
 * its dimension. Never crashes the boot: if the gateway is unreachable
 * (e.g. EHOSTUNREACH before the network is up), it retries in background with
 * exponential backoff so the service starts degraded instead of crash-looping.
 */
@Injectable()
export class VectorIndexInitializerService implements OnApplicationShutdown {
  private readonly logger = new Logger(VectorIndexInitializerService.name);
  private retryTimer?: NodeJS.Timeout;
  private ready = false;
  private shuttingDown = false;

  constructor(
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
  ) {}

  get isReady(): boolean {
    return this.ready;
  }

  /** Never rejects: a failed probe schedules background retries instead. */
  async initialize(): Promise<void> {
    await this.attempt(INITIAL_RETRY_DELAY_MS);
  }

  onApplicationShutdown(): void {
    this.shuttingDown = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  private async attempt(nextDelayMs: number): Promise<void> {
    if (this.ready || this.shuttingDown) {
      return;
    }

    try {
      const probeVector = await this.embeddingPort.embed('vector dimension probe');
      await this.graphStore.ensureVectorIndex(probeVector.length);
      this.ready = true;
      this.logger.log(`Neo4j vector index ready (${probeVector.length} dimensions).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Vector index init failed (${message}); retrying in ${Math.round(nextDelayMs / 1000)}s`,
      );
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        void this.attempt(Math.min(nextDelayMs * 2, MAX_RETRY_DELAY_MS));
      }, nextDelayMs);
      this.retryTimer.unref?.();
    }
  }
}
