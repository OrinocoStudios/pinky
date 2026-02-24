import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DocumentRepositoryPort } from '../../documents/domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
export declare class GraphSyncRetryService implements OnModuleInit, OnModuleDestroy {
    private readonly documentRepository;
    private readonly graphStore;
    private readonly logger;
    private intervalId?;
    constructor(documentRepository: DocumentRepositoryPort, graphStore: GraphStorePort);
    onModuleInit(): void;
    onModuleDestroy(): void;
    retry(limit: number): Promise<{
        processed: number;
        synced: number;
        failed: number;
    }>;
}
