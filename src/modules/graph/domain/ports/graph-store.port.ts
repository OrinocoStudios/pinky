import { ExtractedGraph, GraphEntity, GraphRelationship } from '../models/graph.model';

export interface ChunkWithEmbedding {
  chunkId: string;
  documentId: string;
  tenantId?: string;
  libraryId?: string;
  seq: number;
  text: string;
  embedding: number[];
  embeddingModel: string;
}

export interface GraphStorePort {
  ping(): Promise<void>;
  upsertGraph(graph: ExtractedGraph, tenantId?: string, libraryId?: string): Promise<void>;
  findEntitiesByNames(
    names: string[],
    tenantId?: string,
    libraryIds?: string[],
  ): Promise<GraphEntity[]>;
  findRelationshipsForEntityIds(
    entityIds: string[],
    tenantId?: string,
    libraryIds?: string[],
  ): Promise<GraphRelationship[]>;
  deleteByDocumentId(documentId: string, tenantId?: string, libraryId?: string): Promise<void>;
  ensureVectorIndex(dimensions: number): Promise<void>;
  saveChunks(chunks: ChunkWithEmbedding[], tenantId?: string, libraryId?: string): Promise<void>;
  linkChunksToEntities(extractedGraph: ExtractedGraph): Promise<void>;
  deleteChunksByDocumentId(documentId: string, tenantId?: string, libraryId?: string): Promise<void>;
}
