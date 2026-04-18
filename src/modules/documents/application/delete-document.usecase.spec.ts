import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeleteDocumentUseCase } from './delete-document.usecase';
import { DOCUMENT_REPOSITORY, GRAPH_STORE_PORT } from '../../../shared/di.tokens';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

describe('DeleteDocumentUseCase', () => {
  let useCase: DeleteDocumentUseCase;
  let repo: Record<string, jest.Mock>;
  let graphStore: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findDocumentById: jest.fn().mockResolvedValue({
        documentId: 'doc-1',
        tenantId: 'tenant-a',
        libraryId: 'lib-1',
      }),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
    };

    graphStore = {
      deleteByDocumentId: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        DeleteDocumentUseCase,
        { provide: DOCUMENT_REPOSITORY, useValue: repo },
        { provide: GRAPH_STORE_PORT, useValue: graphStore },
        { provide: StructuredLogger, useValue: { event: jest.fn(), log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    useCase = module.get(DeleteDocumentUseCase);
  });

  it('should delete document from graph and repository', async () => {
    await useCase.execute('doc-1');

    expect(graphStore.deleteByDocumentId).toHaveBeenCalledWith('doc-1', undefined, undefined);
    expect(repo.deleteDocument).toHaveBeenCalledWith('doc-1');
  });

  it('should throw NotFoundException for non-existent document', async () => {
    repo.findDocumentById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
    expect(graphStore.deleteByDocumentId).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException for cross-tenant access', async () => {
    await expect(useCase.execute('doc-1', 'tenant-b')).rejects.toThrow(NotFoundException);
    expect(repo.deleteDocument).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException for cross-library access', async () => {
    await expect(useCase.execute('doc-1', undefined, 'lib-other')).rejects.toThrow(NotFoundException);
    expect(repo.deleteDocument).not.toHaveBeenCalled();
  });

  it('should pass tenantId and libraryId to graphStore', async () => {
    await useCase.execute('doc-1', 'tenant-a', 'lib-1');

    expect(graphStore.deleteByDocumentId).toHaveBeenCalledWith('doc-1', 'tenant-a', 'lib-1');
  });
});
