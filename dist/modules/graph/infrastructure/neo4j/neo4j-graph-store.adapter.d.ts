import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphStorePort } from '../../domain/ports/graph-store.port';
import { ExtractedGraph, GraphEntity, GraphRelationship } from '../../domain/models/graph.model';
import { BrainConfig } from '../../../../config/configuration';
export declare class Neo4jGraphStoreAdapter implements GraphStorePort, OnModuleDestroy {
    private readonly configService;
    private readonly driver;
    constructor(configService: ConfigService<BrainConfig>);
    ping(): Promise<void>;
    upsertGraph(graph: ExtractedGraph): Promise<void>;
    findEntitiesByNames(names: string[]): Promise<GraphEntity[]>;
    findRelationshipsForEntityIds(entityIds: string[]): Promise<GraphRelationship[]>;
    deleteByDocumentId(documentId: string): Promise<void>;
    private createSession;
    onModuleDestroy(): Promise<void>;
}
