import { DocumentChunk } from '../../../documents/domain/models/document.model';
import { ChunkSearchPort, ChunkSearchQuery } from '../../domain/ports/chunk-search.port';
export declare class ElasticsearchChunkSearchAdapter implements ChunkSearchPort {
    hybridSearch(_query: ChunkSearchQuery): Promise<DocumentChunk[]>;
}
