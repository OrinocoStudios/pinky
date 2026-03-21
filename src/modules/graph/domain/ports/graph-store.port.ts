import { ExtractedGraph, GraphEntity, GraphRelationship } from '../models/graph.model';

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
}
