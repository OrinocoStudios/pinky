import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, EMBEDDING_PORT } from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { EmbeddingPort } from '../domain/ports/embedding.port';

export type ReindexChunksInput = {
  limit?: number;
  mode?: 'rebuild' | 'incremental';
  tenantId?: string;
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
  ) {}

  async execute(input: ReindexChunksInput = {}): Promise<ReindexChunksOutput> {
    const limit = input.limit ?? 10000;
    const mode = input.mode ?? 'rebuild';
    const embeddingModel = this.embeddingPort.getModelId();
    const chunks =
      mode === 'incremental'
        ? await this.documentRepository.listChunksNeedingReindex(embeddingModel, limit, input.tenantId)
        : await this.documentRepository.listAllChunks(limit, input.tenantId);
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

    return { processed, failed, embeddingModel };
  }
}
