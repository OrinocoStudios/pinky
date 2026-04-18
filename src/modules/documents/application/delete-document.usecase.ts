import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

@Injectable()
export class DeleteDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(GRAPH_STORE_PORT)
    private readonly graphStore: GraphStorePort,
    private readonly events: StructuredLogger,
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

    const startedAt = Date.now();
    await this.graphStore.deleteByDocumentId(documentId, tenantId, libraryId);
    await this.documentRepository.deleteDocument(documentId);
    this.events.event('DocumentDeleted', {
      documentId,
      tenantId: tenantId ?? doc.tenantId,
      libraryId: libraryId ?? doc.libraryId,
      latencyMs: Date.now() - startedAt,
    });
  }
}
