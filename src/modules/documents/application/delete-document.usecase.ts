import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';

@Injectable()
export class DeleteDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
  ) {}

  async execute(documentId: string, tenantId?: string, libraryId?: string): Promise<void> {
    const doc = await this.documentRepository.findDocumentById(documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (tenantId && doc.tenantId !== tenantId) {
      // Return 404 to avoid disclosing document existence across tenants.
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (libraryId && doc.libraryId !== libraryId) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    await this.graphStore.deleteByDocumentId(documentId, tenantId, libraryId);
    await this.documentRepository.deleteDocument(documentId);
  }
}
