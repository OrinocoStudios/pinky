import { DocumentChunk } from '../../../documents/domain/models/document.model';
import { ChunkSearchPort, ChunkSearchQuery } from '../../domain/ports/chunk-search.port';
import { MongoDatabaseService } from '../../../documents/infrastructure/mongo/mongo-database.service';
import { EmbeddingPort } from '../../../ingestion/domain/ports/embedding.port';
export declare class MongoChunkSearchAdapter implements ChunkSearchPort {
    private readonly db;
    private readonly embeddingPort;
    constructor(db: MongoDatabaseService, embeddingPort: EmbeddingPort);
    hybridSearch(query: ChunkSearchQuery): Promise<DocumentChunk[]>;
    private cosineSimilarity;
    private textOverlapScore;
}
