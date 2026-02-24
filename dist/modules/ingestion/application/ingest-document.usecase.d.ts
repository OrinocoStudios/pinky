import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { DocumentRecord } from '../../documents/domain/models/document.model';
import { EmbeddingPort } from '../domain/ports/embedding.port';
import { GraphExtractorPort } from '../domain/ports/graph-extractor.port';
import { SimpleChunkerService } from './simple-chunker.service';
export type IngestDocumentInput = {
    title?: string;
    rawText: string;
    source: DocumentRecord['source'];
    metadata?: Record<string, unknown>;
};
export declare class IngestDocumentUseCase {
    private readonly documentRepository;
    private readonly graphStore;
    private readonly embeddingPort;
    private readonly graphExtractor;
    private readonly chunker;
    constructor(documentRepository: DocumentRepositoryPort, graphStore: GraphStorePort, embeddingPort: EmbeddingPort, graphExtractor: GraphExtractorPort, chunker: SimpleChunkerService);
    execute(input: IngestDocumentInput): Promise<DocumentRecord>;
}
