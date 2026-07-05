import { DocumentChunk } from '../../../documents/domain/models/document.model';

export interface ChunkSearchQuery {
  queryText: string;
  topK: number;
  tenantId?: string;
  libraryIds?: string[];
}

/**
 * DocumentChunk enriched with the vector-search relevance score.
 * Optional so adapters without scoring (e.g. Elasticsearch) stay compatible.
 */
export type ScoredChunk = DocumentChunk & { score?: number };

export interface ChunkSearchPort {
  hybridSearch(query: ChunkSearchQuery): Promise<ScoredChunk[]>;
}
