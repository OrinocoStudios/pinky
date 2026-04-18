import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, EMBEDDING_PORT } from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { EmbeddingPort } from '../domain/ports/embedding.port';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

export type ReindexChunksInput = {
  limit?: number;
  mode?: 'rebuild' | 'incremental';
  tenantId?: string;
  libraryId?: string;
};

export type ReindexChunksOutput = {
  processed: number;
  failed: number;
  embeddingModel: string;
};

@Injectable()
export class ReindexChunksUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(EMBEDDING_PORT)
    private readonly embeddingPort: EmbeddingPort,
    private readonly events: StructuredLogger,
  ) {}

  async execute(input: ReindexChunksInput = {}): Promise<ReindexChunksOutput> {
    const limit = input.limit ?? 10000;
    const mode = input.mode ?? 'rebuild';
    const startedAt = Date.now();
    const embeddingModel = this.embeddingPort.getModelId();
    const chunks =
      mode === 'incremental'
        ? await this.documentRepository.listChunksNeedingReindex(
            embeddingModel,
            limit,
            input.tenantId,
            input.libraryId,
          )
        : await this.documentRepository.listAllChunks(limit, input.tenantId, input.libraryId);
    let processed = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddingPort.embed(chunk.text);
        await this.documentRepository.updateChunkEmbedding(
          chunk.chunkId,
          embedding,
          embeddingModel,
        );
        processed++;
      } catch {
        failed++;
      }
    }

    this.events.event('IndexRebuilt', {
      mode,
      processed,
      failed,
      embeddingModel,
      tenantId: input.tenantId,
      libraryId: input.libraryId,
      latencyMs: Date.now() - startedAt,
    });

    return { processed, failed, embeddingModel };
  }
}
