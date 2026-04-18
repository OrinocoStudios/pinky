import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { IngestDocumentUseCase, IngestDocumentInput } from './ingest-document.usecase';
import { SimpleChunkerService } from './simple-chunker.service';
import { ChecksumService } from '../../../common/utils/checksum.service';
import {
  DOCUMENT_REPOSITORY,
  EMBEDDING_PORT,
  GRAPH_EXTRACTOR_PORT,
  GRAPH_STORE_PORT,
} from '../../../shared/di.tokens';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

const makeInput = (overrides?: Partial<IngestDocumentInput>): IngestDocumentInput => ({
  rawText: 'Some document text that is long enough to be meaningful for chunking.',
  source: { kind: 'generated', useCaseId: 'test' },
  ...overrides,
});

describe('IngestDocumentUseCase', () => {
  let useCase: IngestDocumentUseCase;
  let repo: Record<string, jest.Mock>;
  let graphStore: Record<string, jest.Mock>;
  let embeddingPort: Record<string, jest.Mock | (() => string)>;
  let graphExtractor: Record<string, jest.Mock | (() => string)>;

  beforeEach(async () => {
    repo = {
      createDocument: jest.fn().mockImplementation((input) => ({
        ...input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      findDocumentByChecksum: jest.fn().mockResolvedValue(null),
      findDocumentByIngestKey: jest.fn().mockResolvedValue(null),
      findDocumentById: jest.fn().mockImplementation((_id) => null),
      addChunks: jest.fn().mockResolvedValue(undefined),
      updateDocumentStatus: jest.fn().mockResolvedValue(undefined),
    };

    graphStore = {
      upsertGraph: jest.fn().mockResolvedValue(undefined),
      linkChunksToEntities: jest.fn().mockResolvedValue(undefined),
    };

    embeddingPort = {
      embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      getModelId: () => 'test-embed-model',
    };

    graphExtractor = {
      extract: jest.fn().mockResolvedValue({
        sourceDocumentId: 'any',
        entities: [
          { entityId: 'e1', type: 'Person', name: 'Alice', attributes: { sourceChunkId: 'c1' } },
        ],
        relationships: [],
      }),
      getModelId: () => 'test-extract-model',
    };

    const module = await Test.createTestingModule({
      providers: [
        IngestDocumentUseCase,
        SimpleChunkerService,
        ChecksumService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config: Record<string, unknown> = {
                'app.enableChecksumValidation': true,
                'app.chunkSize': 500,
                'app.chunkOverlap': 50,
              };
              return config[key];
            },
          },
        },
        { provide: DOCUMENT_REPOSITORY, useValue: repo },
        { provide: GRAPH_STORE_PORT, useValue: graphStore },
        { provide: EMBEDDING_PORT, useValue: embeddingPort },
        { provide: GRAPH_EXTRACTOR_PORT, useValue: graphExtractor },
        makeCounterProvider({ name: 'brain_documents_ingested_total', help: 'test' }),
        { provide: StructuredLogger, useValue: { event: jest.fn(), log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    useCase = module.get(IngestDocumentUseCase);
  });

  it('should execute the full ingest pipeline', async () => {
    const result = await useCase.execute(makeInput());

    expect(result.status).toBe('RECEIVED');
    expect(repo.createDocument).toHaveBeenCalledTimes(1);
    expect(repo.addChunks).toHaveBeenCalledTimes(1);
    expect(graphStore.upsertGraph).toHaveBeenCalledTimes(1);
    expect(graphStore.linkChunksToEntities).toHaveBeenCalledTimes(1);
  });

  it('should embed each chunk', async () => {
    await useCase.execute(makeInput());

    const chunks = repo.addChunks.mock.calls[0][0];
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk: any) => {
      expect(chunk.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(chunk.embeddingModel).toBe('test-embed-model');
    });
  });

  it('should pass embedded chunks to the document repository', async () => {
    await useCase.execute(makeInput());

    expect(repo.addChunks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ embedding: [0.1, 0.2, 0.3] }),
      ]),
    );
  });

  it('should deduplicate by checksum', async () => {
    const existing = {
      documentId: 'existing-doc',
      ingestKey: 'existing-ingest-key',
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    repo.findDocumentByIngestKey.mockResolvedValue(existing);

    const result = await useCase.execute(makeInput());

    expect(result.documentId).toBe('existing-doc');
    expect(repo.createDocument).not.toHaveBeenCalled();
    expect(repo.addChunks).not.toHaveBeenCalled();
  });

  it('should generate an ingestKey when creating a document', async () => {
    await useCase.execute(makeInput());

    const createCall = repo.createDocument.mock.calls[0][0];
    expect(createCall.ingestKey).toEqual(expect.any(String));
    expect(createCall.ingestKey).toHaveLength(64);
  });

  it('should return existing document after concurrent ingestKey collision', async () => {
    const existing = {
      documentId: 'existing-doc',
      ingestKey: 'existing-ingest-key',
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    repo.createDocument.mockRejectedValue({
      code: 'Neo.ClientError.Schema.ConstraintValidationFailed',
      message: 'document_ingest_key constraint failed for ingestKey',
    });
    repo.findDocumentByIngestKey.mockResolvedValue(existing);

    const result = await useCase.execute(makeInput());

    expect(result.documentId).toBe('existing-doc');
    expect(repo.addChunks).not.toHaveBeenCalled();
    expect(graphStore.upsertGraph).not.toHaveBeenCalled();
  });

  it('should allow same rawText in different libraries', async () => {
    const text = 'Same text across libraries';

    const first = await useCase.execute(makeInput({ rawText: text, libraryId: 'lib-a' }));
    const second = await useCase.execute(makeInput({ rawText: text, libraryId: 'lib-b' }));

    expect(first.documentId).not.toBe(second.documentId);
    expect(repo.createDocument).toHaveBeenCalledTimes(2);
  });

  it('should store metadata with embedding and extraction model', async () => {
    await useCase.execute(makeInput({ metadata: { custom: 'value' } }));

    const createCall = repo.createDocument.mock.calls[0][0];
    expect(createCall.metadata).toEqual({
      custom: 'value',
      embedding_model: 'test-embed-model',
      extraction_model: 'test-extract-model',
    });
  });

  it('should propagate tenantId and libraryId', async () => {
    await useCase.execute(makeInput({ tenantId: 'tenant-a', libraryId: 'lib-1' }));

    const createCall = repo.createDocument.mock.calls[0][0];
    expect(createCall.tenantId).toBe('tenant-a');
    expect(createCall.libraryId).toBe('lib-1');

    expect(repo.addChunks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 'tenant-a', libraryId: 'lib-1' }),
      ]),
    );
  });

  it('should set status to ERROR when graph sync fails', async () => {
    graphStore.upsertGraph.mockRejectedValue(new Error('Neo4j down'));

    await expect(useCase.execute(makeInput())).rejects.toThrow();

    expect(repo.updateDocumentStatus).toHaveBeenCalledWith(
      expect.any(String),
      'ERROR',
      'FAILED',
    );
  });
});
