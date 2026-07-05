import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { GraphRagQueryUseCase } from './graph-rag-query.usecase';
import { ChunkScoreFilterService } from './chunk-score-filter.service';
import { PromptBudgetService } from './prompt-budget.service';
import { PromptTemplateService } from './prompt-template.service';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';
import {
  ANSWER_GENERATOR_PORT,
  CHAT_HISTORY_REPOSITORY,
  CHUNK_SEARCH_PORT,
  DOCUMENT_REPOSITORY,
  GRAPH_STORE_PORT,
  QUERY_DOCUMENT_ANALYTICS_REPOSITORY,
} from '../../../shared/di.tokens';

describe('GraphRagQueryUseCase', () => {
  let useCase: GraphRagQueryUseCase;
  let chunkSearch: Record<string, jest.Mock>;
  let documentRepository: Record<string, jest.Mock>;
  let graphStore: Record<string, jest.Mock>;
  let answerGenerator: Record<string, jest.Mock>;
  let chatHistory: Record<string, jest.Mock>;
  let queryDocumentAnalytics: Record<string, jest.Mock>;
  let configValues: Record<string, unknown>;

  beforeEach(async () => {
    chunkSearch = {
      hybridSearch: jest.fn().mockResolvedValue([
        { chunkId: 'c1', documentId: 'd1', seq: 0, text: 'Einstein developed relativity.', createdAt: '' },
      ]),
    };
    documentRepository = {
      findDocumentById: jest.fn().mockResolvedValue({
        documentId: 'd1',
        title: 'Clinical note',
        libraryId: 'patient:p1:medical_history',
        metadata: {
          engineDocumentId: 'engine-doc-1',
          documentCategory: 'medical_history',
        },
      }),
    };

    graphStore = {
      findEntitiesByNames: jest.fn().mockResolvedValue([
        { entityId: 'e1', type: 'Person', name: 'Einstein' },
      ]),
      findRelationshipsForEntityIds: jest.fn().mockResolvedValue([
        {
          fromEntityId: 'e1',
          toEntityId: 'e2',
          type: 'DEVELOPED',
          sourceChunkId: 'c1',
          confidence: 0.9,
        },
      ]),
    };

    answerGenerator = {
      generate: jest.fn().mockResolvedValue({
        answer: 'Einstein developed the theory of relativity. [CTX-1][FACT-1]',
        sourcesUsed: ['CTX-1', 'FACT-1'],
        model: 'test-llm',
        tokensUsed: 50,
      }),
    };

    chatHistory = {
      saveMessage: jest.fn().mockResolvedValue(undefined),
      getBySessionId: jest.fn().mockResolvedValue([]),
      clearSession: jest.fn().mockResolvedValue(undefined),
    };
    queryDocumentAnalytics = {
      saveRetrievedDocuments: jest.fn().mockResolvedValue(undefined),
      getTopDocumentsByQueryCount: jest.fn().mockResolvedValue([]),
    };

    configValues = {
      'app.scoreRelativeMargin': 0.05,
      'app.scoreMin': 0,
      'llm.contextWindow': 8192,
      'llm.promptTokenMargin': 512,
      'llm.provider': 'openai',
      'llm.openai.maxTokens': 1536,
    };

    const module = await Test.createTestingModule({
      providers: [
        GraphRagQueryUseCase,
        ChunkScoreFilterService,
        PromptBudgetService,
        PromptTemplateService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => configValues[key]) },
        },
        {
          provide: StructuredLogger,
          useValue: { debug: jest.fn(), log: jest.fn(), error: jest.fn(), event: jest.fn() },
        },
        { provide: CHUNK_SEARCH_PORT, useValue: chunkSearch },
        { provide: DOCUMENT_REPOSITORY, useValue: documentRepository },
        { provide: GRAPH_STORE_PORT, useValue: graphStore },
        { provide: ANSWER_GENERATOR_PORT, useValue: answerGenerator },
        { provide: CHAT_HISTORY_REPOSITORY, useValue: chatHistory },
        { provide: QUERY_DOCUMENT_ANALYTICS_REPOSITORY, useValue: queryDocumentAnalytics },
        makeCounterProvider({ name: 'brain_queries_total', help: 'test' }),
        makeCounterProvider({ name: 'brain_query_errors_total', help: 'test' }),
        makeHistogramProvider({ name: 'brain_query_latency_ms', help: 'test', buckets: [100] }),
      ],
    }).compile();

    useCase = module.get(GraphRagQueryUseCase);
  });

  it('should execute the full query pipeline', async () => {
    const result = await useCase.execute({ query: 'What did Einstein develop?', topK: 5 });

    expect(chunkSearch.hybridSearch).toHaveBeenCalledWith(
      expect.objectContaining({ queryText: 'What did Einstein develop?', topK: 5 }),
    );
    expect(graphStore.findEntitiesByNames).toHaveBeenCalled();
    expect(graphStore.findRelationshipsForEntityIds).toHaveBeenCalledWith(
      ['e1'],
      undefined,
      undefined,
    );
    expect(answerGenerator.generate).toHaveBeenCalled();
    expect(result.answer).toContain('Einstein');
    expect(result.model).toBe('test-llm');
    expect(result.tokensUsed).toBe(50);
  });

  it('should include chunks in fastContext', async () => {
    const result = await useCase.execute({ query: 'test', topK: 5 });

    expect(result.fastContext).toHaveLength(1);
    expect(result.fastContext[0].text).toContain('Einstein');
    expect(result.fastContext[0].documentId).toBe('d1');
    expect(result.fastContext[0].metadata).toEqual(
      expect.objectContaining({ engineDocumentId: 'engine-doc-1' }),
    );
  });

  it('should include graph relations in truthFacts', async () => {
    const result = await useCase.execute({ query: 'test', topK: 5 });

    expect(result.truthFacts).toHaveLength(1);
    expect(result.truthFacts[0].relation).toBe('DEVELOPED');
  });

  it('should use provided entityHints', async () => {
    await useCase.execute({
      query: 'test',
      topK: 5,
      entityHints: ['Einstein', 'Relativity'],
    });

    expect(graphStore.findEntitiesByNames).toHaveBeenCalledWith(
      ['Einstein', 'Relativity'],
      undefined,
      undefined,
    );
  });

  it('should handle empty corpus gracefully', async () => {
    chunkSearch.hybridSearch.mockResolvedValue([]);
    graphStore.findEntitiesByNames.mockResolvedValue([]);
    graphStore.findRelationshipsForEntityIds.mockResolvedValue([]);

    const result = await useCase.execute({ query: 'anything', topK: 5 });

    expect(result.fastContext).toEqual([]);
    expect(result.truthFacts).toEqual([]);
    expect(result.answer).toBeDefined();
  });

  it('should scope search by tenantId and libraryIds', async () => {
    await useCase.execute({
      query: 'test',
      topK: 5,
      tenantId: 'tenant-a',
      libraryIds: ['lib-1'],
    });

    expect(chunkSearch.hybridSearch).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', libraryIds: ['lib-1'] }),
    );
    expect(graphStore.findEntitiesByNames).toHaveBeenCalledWith(
      expect.any(Array),
      'tenant-a',
      ['lib-1'],
    );
  });

  it('should build prompt containing context and query', async () => {
    await useCase.execute({ query: 'What did Einstein develop?', topK: 5 });

    const promptArg = answerGenerator.generate.mock.calls[0][0].prompt;
    expect(promptArg).toContain('What did Einstein develop?');
    expect(promptArg).toContain('Einstein developed relativity.');
  });

  it('should persist tenant scope in chat history', async () => {
    await useCase.execute({
      query: 'scope test',
      topK: 5,
      tenantId: 'tenant-1',
      libraryIds: ['lib-1'],
      sessionId: 'session-1',
    });

    expect(chatHistory.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        libraryId: 'lib-1',
      }),
    );
  });

  it('should drop low-score chunks from prompt, fastContext and analytics', async () => {
    chunkSearch.hybridSearch.mockResolvedValue([
      { chunkId: 'c1', documentId: 'd1', seq: 0, text: 'Ibuprofeno 400 mg venta libre.', createdAt: '', score: 0.91 },
      { chunkId: 'c2', documentId: 'd2', seq: 0, text: 'Viruela símica brote 2022.', createdAt: '', score: 0.84 },
    ]);
    documentRepository.findDocumentById
      .mockResolvedValueOnce({ documentId: 'd1', title: 'CIMA: Ibuprofeno', metadata: {}, libraryId: 'lib-1' })
      .mockResolvedValueOnce({ documentId: 'd2', title: 'OMS: Viruela símica', metadata: {}, libraryId: 'lib-1' });

    const result = await useCase.execute({ query: 'ibuprofeno sin receta', topK: 5 });

    expect(result.fastContext.map((c) => c.id)).toEqual(['c1']);
    const promptArg = answerGenerator.generate.mock.calls[0][0].prompt;
    expect(promptArg).not.toContain('Viruela símica');
    const analyticsDocuments = queryDocumentAnalytics.saveRetrievedDocuments.mock.calls[0][0].documents;
    expect(analyticsDocuments.map((d: any) => d.documentId)).toEqual(['d1']);
  });

  it('should expose the chunk score in fastContext', async () => {
    chunkSearch.hybridSearch.mockResolvedValue([
      { chunkId: 'c1', documentId: 'd1', seq: 0, text: 'A', createdAt: '', score: 0.9 },
    ]);

    const result = await useCase.execute({ query: 'test', topK: 5 });

    expect(result.fastContext[0].score).toBe(0.9);
  });

  it('should keep every chunk when scores are within the margin', async () => {
    chunkSearch.hybridSearch.mockResolvedValue([
      { chunkId: 'c1', documentId: 'd1', seq: 0, text: 'A', createdAt: '', score: 0.91 },
      { chunkId: 'c2', documentId: 'd1', seq: 1, text: 'B', createdAt: '', score: 0.9 },
    ]);

    const result = await useCase.execute({ query: 'test', topK: 5 });

    expect(result.fastContext).toHaveLength(2);
  });

  it('should trim prompt to the token budget: worst chunk and excess facts dropped', async () => {
    const budgetService = new PromptBudgetService();
    const templateService = new PromptTemplateService();
    const query = 'presupuesto test';
    const keptText = 'K'.repeat(700);
    const droppedText = 'D'.repeat(700);
    chunkSearch.hybridSearch.mockResolvedValue([
      { chunkId: 'c1', documentId: 'd1', seq: 0, text: keptText, createdAt: '', score: 0.9 },
      { chunkId: 'c2', documentId: 'd1', seq: 1, text: droppedText, createdAt: '', score: 0.88 },
    ]);

    // Window sized so the budget covers the base prompt + only the best chunk.
    const baseText = templateService.buildGroundedPrompt({ query, contextSources: [], graphFacts: [] }).prompt;
    const promptTokens = budgetService.estimateTokens(baseText) + budgetService.chunkCost({ text: keptText });
    configValues['llm.promptTokenMargin'] = 0;
    configValues['llm.contextWindow'] = promptTokens + (configValues['llm.openai.maxTokens'] as number);

    const result = await useCase.execute({ query, topK: 5 });

    const promptArg = answerGenerator.generate.mock.calls[0][0].prompt;
    expect(promptArg).toContain(keptText);
    expect(promptArg).not.toContain(droppedText);
    expect(result.fastContext.map((c) => c.id)).toEqual(['c1']);
    expect(result.truthFacts).toEqual([]);
  });

  it('should persist deduplicated retrieved documents for analytics', async () => {
    chunkSearch.hybridSearch.mockResolvedValue([
      { chunkId: 'c1', documentId: 'd1', seq: 0, text: 'A', createdAt: '' },
      { chunkId: 'c2', documentId: 'd1', seq: 1, text: 'B', createdAt: '' },
      { chunkId: 'c3', documentId: 'd2', seq: 2, text: 'C', createdAt: '' },
    ]);
    documentRepository.findDocumentById
      .mockResolvedValueOnce({ documentId: 'd1', title: 'Doc A', metadata: {}, libraryId: 'lib-1' })
      .mockResolvedValueOnce({ documentId: 'd2', title: 'Doc B', metadata: {}, libraryId: 'lib-1' });

    await useCase.execute({ query: 'dedup test', topK: 5, tenantId: 'tenant-a', libraryIds: ['lib-1'] });

    expect(queryDocumentAnalytics.saveRetrievedDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        libraryId: 'lib-1',
        documents: expect.arrayContaining([
          expect.objectContaining({ documentId: 'd1' }),
          expect.objectContaining({ documentId: 'd2' }),
        ]),
      }),
    );
    const callDocuments = queryDocumentAnalytics.saveRetrievedDocuments.mock.calls[0][0].documents;
    expect(callDocuments).toHaveLength(2);
  });
});
