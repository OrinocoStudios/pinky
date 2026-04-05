import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, InMemoryDocumentRepository } from './test-helpers';

describe('Index (e2e)', () => {
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

  // ── POST /index/rebuild ──────────────────────────────────────

  describe('POST /index/rebuild', () => {
    it('should return zero when no chunks exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/index/rebuild')
        .send({ limit: 10 })
        .expect(201);

      expect(res.body.processed).toBe(0);
      expect(res.body.failed).toBe(0);
      expect(res.body.embeddingModel).toBe('mock-embed-model');
    });

    it('should reindex existing chunks', async () => {
      // Ingest a document to create chunks
      await request(app.getHttpServer())
        .post('/documents/text')
        .send({
          title: 'Reindex Test',
          rawText: 'Content for reindexing test document with enough text to chunk.',
        })
        .expect(201);

      const chunkCount = repo.chunks.length;

      const res = await request(app.getHttpServer())
        .post('/index/rebuild')
        .send({ limit: 100 })
        .expect(201);

      expect(res.body.processed).toBe(chunkCount);
      expect(res.body.failed).toBe(0);
    });
  });

  // ── POST /index/incremental ──────────────────────────────────

  describe('POST /index/incremental', () => {
    it('should return zero when all chunks are up-to-date', async () => {
      const res = await request(app.getHttpServer())
        .post('/index/incremental')
        .send({})
        .expect(201);

      expect(res.body.processed).toBe(0);
      expect(res.body.failed).toBe(0);
    });

    it('should reindex only outdated chunks', async () => {
      // Add a chunk with an old embedding model
      repo.chunks.push({
        chunkId: 'chunk-old',
        documentId: 'doc-1',
        seq: 0,
        text: 'Old chunk needing reindex.',
        embedding: [0.1],
        embeddingModel: 'old-model',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .post('/index/incremental')
        .send({})
        .expect(201);

      expect(res.body.processed).toBe(1);
      expect(res.body.failed).toBe(0);

      // Verify the chunk was updated
      const updated = repo.chunks.find((c) => c.chunkId === 'chunk-old');
      expect(updated?.embeddingModel).toBe('mock-embed-model');
    });
  });
});
