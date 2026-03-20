import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, InMemoryDocumentRepository } from './test-helpers';

describe('Multi-tenant (e2e)', () => {
  let app: INestApplication;
  let repo: InMemoryDocumentRepository;

  beforeAll(async () => {
    ({ app, repo } = await createTestApp({ app: { enableMultiTenant: true } }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repo.reset();
  });

  it('requires X-Tenant-Id on ingest when multi-tenant is enabled', async () => {
    await request(app.getHttpServer())
      .post('/documents/text')
      .send({ rawText: 'tenant protected content' })
      .expect(400);
  });

  it('requires X-Tenant-Id on query when multi-tenant is enabled', async () => {
    await request(app.getHttpServer())
      .post('/query')
      .send({ query: 'what is this?' })
      .expect(400);
  });

  it('isolates retrieval by tenant', async () => {
    await request(app.getHttpServer())
      .post('/documents/text')
      .set('X-Tenant-Id', 'tenant-a')
      .send({ title: 'A', rawText: 'Alpha tenant content only.' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/documents/text')
      .set('X-Tenant-Id', 'tenant-b')
      .send({ title: 'B', rawText: 'Beta tenant private content only.' })
      .expect(201);

    const queryA = await request(app.getHttpServer())
      .post('/query')
      .set('X-Tenant-Id', 'tenant-a')
      .send({ query: 'Alpha content?', topK: 8 })
      .expect(201);

    const queryB = await request(app.getHttpServer())
      .post('/query')
      .set('X-Tenant-Id', 'tenant-b')
      .send({ query: 'Beta content?', topK: 8 })
      .expect(201);

    const contextA = (queryA.body.fastContext ?? []).map((c: { text: string }) => c.text).join(' ');
    const contextB = (queryB.body.fastContext ?? []).map((c: { text: string }) => c.text).join(' ');

    expect(contextA).toContain('Alpha tenant content');
    expect(contextA).not.toContain('Beta tenant private');
    expect(contextB).toContain('Beta tenant private');
    expect(contextB).not.toContain('Alpha tenant content');
  });

  it('prevents cross-tenant delete (IDOR)', async () => {
    const created = await request(app.getHttpServer())
      .post('/documents/text')
      .set('X-Tenant-Id', 'tenant-a')
      .send({ title: 'Private A', rawText: 'Tenant A secret data' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/documents/${created.body.documentId}`)
      .set('X-Tenant-Id', 'tenant-b')
      .expect(404);

    const docsA = await request(app.getHttpServer())
      .get('/documents')
      .set('X-Tenant-Id', 'tenant-a')
      .expect(200);
    expect(docsA.body).toHaveLength(1);
    expect(docsA.body[0].documentId).toBe(created.body.documentId);
  });

  it('requires X-Tenant-Id on index and outbox endpoints when enabled', async () => {
    await request(app.getHttpServer()).post('/index/rebuild').send({ limit: 10 }).expect(400);
    await request(app.getHttpServer()).post('/outbox/retry').send({ limit: 10 }).expect(400);
  });

  it('reindexes only chunks of the requested tenant', async () => {
    await request(app.getHttpServer())
      .post('/documents/text')
      .set('X-Tenant-Id', 'tenant-a')
      .send({ rawText: 'Alpha one.' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/documents/text')
      .set('X-Tenant-Id', 'tenant-b')
      .send({ rawText: 'Beta one.' })
      .expect(201);

    repo.chunks.forEach((chunk) => {
      chunk.embeddingModel = 'old-model';
    });

    const aChunksBefore = repo.chunks.filter((c) => c.tenantId === 'tenant-a').length;
    const bChunkIds = repo.chunks.filter((c) => c.tenantId === 'tenant-b').map((c) => c.chunkId);

    const res = await request(app.getHttpServer())
      .post('/index/incremental')
      .set('X-Tenant-Id', 'tenant-a')
      .send({ limit: 100 })
      .expect(201);

    expect(res.body.processed).toBe(aChunksBefore);
    expect(
      repo.chunks.filter((c) => bChunkIds.includes(c.chunkId)).every((c) => c.embeddingModel === 'old-model'),
    ).toBe(true);
  });

  it('retries outbox events only for requested tenant', async () => {
    repo.outboxEvents.push(
      {
        eventId: 'evt-a',
        documentId: 'doc-a',
        tenantId: 'tenant-a',
        payload: JSON.stringify({ sourceDocumentId: 'doc-a', entities: [], relationships: [] }),
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        eventId: 'evt-b',
        documentId: 'doc-b',
        tenantId: 'tenant-b',
        payload: JSON.stringify({ sourceDocumentId: 'doc-b', entities: [], relationships: [] }),
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );

    const res = await request(app.getHttpServer())
      .post('/outbox/retry')
      .set('X-Tenant-Id', 'tenant-a')
      .send({ limit: 5 })
      .expect(201);

    expect(res.body.processed).toBe(1);
    expect(repo.outboxEvents.find((e) => e.eventId === 'evt-a')?.status).toBe('SYNCED');
    expect(repo.outboxEvents.find((e) => e.eventId === 'evt-b')?.status).toBe('PENDING');
  });
});

