import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-helpers';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health — should return ok status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('brain-service');
    expect(res.body.services.neo4j.status).toBe('up');
    expect(res.body.services.llm).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(typeof res.body.uptime).toBe('number');
  });
});
