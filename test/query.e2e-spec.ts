import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, InMemoryDocumentRepository } from './test-helpers';

describe('Query (e2e)', () => {
  let app: INestApplication;
  let repo: InMemoryDocumentRepository;

  beforeAll(async () => {
    ({ app, repo } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repo.reset();
  });

  it('POST /query — should return answer with sources when documents exist', async () => {
    // Ingest a document first
    await request(app.getHttpServer())
      .post('/documents/text')
      .send({
        title: 'Physics',
        rawText: 'Albert Einstein developed the theory of relativity and won the Nobel Prize.',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/query')
      .send({ query: 'What did Einstein develop?', topK: 5 })
      .expect(201);

    expect(res.body.answer).toBeDefined();
    expect(res.body.answer.length).toBeGreaterThan(0);
    expect(res.body.sourcesUsed).toBeInstanceOf(Array);
    expect(res.body.fastContext).toBeInstanceOf(Array);
    expect(res.body.truthFacts).toBeInstanceOf(Array);
    expect(res.body.model).toBe('mock-llm');
    expect(res.body.tokensUsed).toBe(42);
    expect(res.body.prompt).toContain('Einstein');
  });

  it('POST /query — should work with empty corpus', async () => {
    const res = await request(app.getHttpServer())
      .post('/query')
      .send({ query: 'Random question with no documents?' })
      .expect(201);

    expect(res.body.answer).toBeDefined();
    expect(res.body.fastContext).toEqual([]);
    expect(res.body.truthFacts).toEqual([]);
  });

  it('POST /query — should reject missing query field', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({})
      .expect(400);
  });

  it('POST /query — should reject invalid topK', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({ query: 'test', topK: 0 })
      .expect(400);
  });

  it('POST /query — should accept entityHints', async () => {
    await request(app.getHttpServer())
      .post('/documents/text')
      .send({
        title: 'Hints Test',
        rawText: 'Marie Curie discovered radium and polonium.',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/query')
      .send({
        query: 'What did Curie discover?',
        entityHints: ['Marie Curie', 'radium'],
        topK: 3,
      })
      .expect(201);

    expect(res.body.answer).toBeDefined();
    expect(res.body.prompt).toContain('Curie');
  });
});
