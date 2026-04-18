import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, InMemoryDocumentRepository } from './test-helpers';

describe('Documents Upload (e2e)', () => {
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

  it('should ingest a multipart plain text upload', async () => {
    const content = 'Uploaded plain text document content for ingestion.';
    const res = await request(app.getHttpServer())
      .post('/documents/upload')
      .attach('file', Buffer.from(content, 'utf-8'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(res.body.documentId).toBeDefined();
    expect(res.body.status).toBe('READY');
    expect(res.body.source.kind).toBe('upload');
    expect(res.body.source.filename).toBe('note.txt');
    expect(res.body.source.mimeType).toBe('text/plain');
    expect(repo.documents).toHaveLength(1);
    expect(repo.chunks.length).toBeGreaterThan(0);
  });

  it('should reject when no file is attached', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents/upload')
      .field('title', 'No file')
      .expect(400);

    expect(String(res.body.message)).toMatch(/file is required/i);
  });

  it('should reject disallowed mime types', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents/upload')
      .attach('file', Buffer.from('<html></html>', 'utf-8'), {
        filename: 'page.html',
        contentType: 'text/html',
      })
      .expect(400);

    expect(String(res.body.message)).toMatch(/not allowed/i);
    expect(repo.documents).toHaveLength(0);
  });

  it('should propagate title override and metadata', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents/upload')
      .field('title', 'Custom title')
      .attach('file', Buffer.from('Some content for upload'), {
        filename: 'upload.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(res.body.title).toBe('Custom title');
    expect(res.body.metadata.size).toBeDefined();
  });
});
