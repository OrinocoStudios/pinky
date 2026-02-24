import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { EmbeddingPort } from '../domain/ports/embedding.port';
export type ReindexChunksInput = {
    limit?: number;
    mode?: 'rebuild' | 'incremental';
};
export type ReindexChunksOutput = {
    processed: number;
    failed: number;
    embeddingModel: string;
};
export declare class ReindexChunksUseCase {
    private readonly documentRepository;
    private readonly embeddingPort;
    constructor(documentRepository: DocumentRepositoryPort, embeddingPort: EmbeddingPort);
    execute(input?: ReindexChunksInput): Promise<ReindexChunksOutput>;
}
