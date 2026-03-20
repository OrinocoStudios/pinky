import { ExtractedGraph, GraphEntity, GraphRelationship } from '../models/graph.model';

export interface GraphStorePort {
  ping(): Promise<void>;
  upsertGraph(graph: ExtractedGraph, tenantId?: string): Promise<void>;
  findEntitiesByNames(names: string[], tenantId?: string): Promise<GraphEntity[]>;
  findRelationshipsForEntityIds(entityIds: string[], tenantId?: string): Promise<GraphRelationship[]>;
  deleteByDocumentId(documentId: string, tenantId?: string): Promise<void>;
}
