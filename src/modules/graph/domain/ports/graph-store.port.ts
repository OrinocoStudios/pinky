import { ExtractedGraph, GraphEntity, GraphRelationship } from '../models/graph.model';

export interface GraphStorePort {
  upsertGraph(graph: ExtractedGraph): Promise<void>;
  findEntitiesByNames(names: string[]): Promise<GraphEntity[]>;
  findRelationshipsForEntityIds(entityIds: string[]): Promise<GraphRelationship[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
