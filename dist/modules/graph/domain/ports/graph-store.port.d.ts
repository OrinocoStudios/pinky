import { ExtractedGraph, GraphEntity, GraphRelationship } from '../models/graph.model';
export interface GraphStorePort {
    ping(): Promise<void>;
    upsertGraph(graph: ExtractedGraph): Promise<void>;
    findEntitiesByNames(names: string[]): Promise<GraphEntity[]>;
    findRelationshipsForEntityIds(entityIds: string[]): Promise<GraphRelationship[]>;
    deleteByDocumentId(documentId: string): Promise<void>;
}
