import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, InMemoryDocumentRepository } from './test-helpers';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let repo: InMemoryDocumentRepository;

  beforeAll(async () => {
    ({ app, repo } = await createTestApp({
      throttling: {
        enabled: true,
        ttl: 60000,
        ingestLimit: 2,
        uploadLimit: 2,
        queryLimit: 2,
        defaultLimit: 5,
      },
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repo.reset();
  });

  it('returns 429 after exceeding the ingest throttle limit on POST /documents/text', async () => {
    const sendRequest = (n: number) =>
      request(app.getHttpServer())
        .post('/documents/text')
        .send({
          title: `Doc ${n}`,
          rawText: `Unique rate limit content number ${n} for throttle testing.`,
        });

    const first = await sendRequest(1);
    const second = await sendRequest(2);
    const third = await sendRequest(3);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
  });

  it('returns 429 after exceeding the upload throttle limit on POST /documents/upload', async () => {
    const sendUpload = (n: number) =>
      request(app.getHttpServer())
        .post('/documents/upload')
        .attach('file', Buffer.from(`Upload content ${n}`), {
          filename: `file-${n}.txt`,
          contentType: 'text/plain',
        });

    const first = await sendUpload(1);
    const second = await sendUpload(2);
    const third = await sendUpload(3);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
  });
});
