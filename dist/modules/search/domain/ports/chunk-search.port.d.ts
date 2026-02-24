import { DocumentChunk } from '../../../documents/domain/models/document.model';
export interface ChunkSearchQuery {
    queryText: string;
    topK: number;
}
export interface ChunkSearchPort {
    hybridSearch(query: ChunkSearchQuery): Promise<DocumentChunk[]>;
}
