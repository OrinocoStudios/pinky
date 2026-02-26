import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, InMemoryDocumentRepository } from './test-helpers';

describe('Documents (e2e)', () => {
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

  // ── POST /documents/text ─────────────────────────────────────

  describe('POST /documents/text', () => {
    it('should ingest a text document successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents/text')
        .send({
          title: 'Test Doc',
          rawText: 'This is a test document with enough content to be meaningful.',
        })
        .expect(201);

      expect(res.body.documentId).toBeDefined();
      expect(res.body.title).toBe('Test Doc');
      expect(res.body.status).toBe('READY');
      expect(res.body.graphSyncStatus).toBe('SYNCED');
      expect(res.body.checksum).toBeDefined();
      expect(res.body.metadata.embedding_model).toBe('mock-embed-model');
      expect(res.body.metadata.extraction_model).toBe('mock-extraction-model');
    });

    it('should reject empty rawText', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents/text')
        .send({ title: 'No Content' })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('rawText'),
        ]),
      );
    });

    it('should reject request with no body', async () => {
      await request(app.getHttpServer())
        .post('/documents/text')
        .send({})
        .expect(400);
    });

    it('should return existing document on duplicate checksum (idempotency)', async () => {
      const text = 'Idempotency test document content for checksum validation.';

      const first = await request(app.getHttpServer())
        .post('/documents/text')
        .send({ title: 'First', rawText: text })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/documents/text')
        .send({ title: 'Second', rawText: text })
        .expect(201);

      expect(second.body.documentId).toBe(first.body.documentId);
      expect(repo.documents).toHaveLength(1);
    });

    it('should reject unknown properties (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/documents/text')
        .send({
          rawText: 'Some content',
          unknownField: 'should be rejected',
        })
        .expect(400);
    });
  });

  // ── GET /documents ───────────────────────────────────────────

  describe('GET /documents', () => {
    it('should return empty array when no documents', async () => {
      const res = await request(app.getHttpServer())
        .get('/documents')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return ingested documents', async () => {
      await request(app.getHttpServer())
        .post('/documents/text')
        .send({ title: 'Doc A', rawText: 'Content of document A for listing test.' });

      await request(app.getHttpServer())
        .post('/documents/text')
        .send({ title: 'Doc B', rawText: 'Content of document B for listing test.' });

      const res = await request(app.getHttpServer())
        .get('/documents')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBeDefined();
      expect(res.body[1].title).toBeDefined();
    });
  });

  // ── DELETE /documents/:id ────────────────────────────────────

  describe('DELETE /documents/:id', () => {
    it('should delete an existing document', async () => {
      const created = await request(app.getHttpServer())
        .post('/documents/text')
        .send({ title: 'To Delete', rawText: 'This document will be deleted from the system.' })
        .expect(201);

      const docId = created.body.documentId;

      const res = await request(app.getHttpServer())
        .delete(`/documents/${docId}`)
        .expect(200);

      expect(res.body.deleted).toBe(docId);
      expect(repo.documents).toHaveLength(0);
      expect(repo.chunks).toHaveLength(0);
    });

    it('should return 404 for non-existent document', async () => {
      await request(app.getHttpServer())
        .delete('/documents/non-existent-id')
        .expect(404);
    });
  });

  // ── POST /documents/generate ─────────────────────────────────

  describe('POST /documents/generate', () => {
    it('should generate and ingest a document', async () => {
      const res = await request(app.getHttpServer())
        .post('/documents/generate')
        .send({ useCaseId: 'sample', title: 'Generated Doc' })
        .expect(201);

      expect(res.body.documentId).toBeDefined();
      expect(res.body.title).toBe('Generated Doc');
      expect(res.body.status).toBe('READY');
      expect(res.body.source.kind).toBe('generated');
      expect(res.body.source.useCaseId).toBe('sample');
    });

    it('should reject missing useCaseId', async () => {
      await request(app.getHttpServer())
        .post('/documents/generate')
        .send({})
        .expect(400);
    });
  });
});
