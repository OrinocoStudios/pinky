import { ExtractedGraph } from '../../../graph/domain/models/graph.model';

export type ChunkInput = {
  chunkId: string;
  text: string;
};

export interface GraphExtractorPort {
  /**
   * Extracts entities and relationships from chunks with structured output.
   * Each relationship must include sourceChunkId for traceability.
   * @param documentId - Source document identifier
   * @param chunks - Chunks to process (extraction per chunk for sourceChunkId accuracy)
   * @returns Merged ExtractedGraph with entities and relationships
   */
  extract(documentId: string, chunks: ChunkInput[]): Promise<ExtractedGraph>;

  /**
   * Returns the model identifier used for extraction (for metadata/versioning).
   */
  getModelId(): string;
}
