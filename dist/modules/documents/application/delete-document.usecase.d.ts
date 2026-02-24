import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
export declare class DeleteDocumentUseCase {
    private readonly documentRepository;
    private readonly graphStore;
    constructor(documentRepository: DocumentRepositoryPort, graphStore: GraphStorePort);
    execute(documentId: string): Promise<void>;
}
