export type EntityType = string;
export interface GraphEntity {
    entityId: string;
    type: EntityType;
    name: string;
    normalized?: string;
    attributes?: Record<string, unknown>;
}
export interface GraphRelationship {
    fromEntityId: string;
    toEntityId: string;
    type: string;
    confidence: number;
    sourceChunkId: string;
    attributes?: Record<string, unknown>;
}
export interface ExtractedGraph {
    sourceDocumentId?: string;
    entities: GraphEntity[];
    relationships: GraphRelationship[];
}
