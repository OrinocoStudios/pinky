import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { createTestApp } from './test-helpers';

describe('Auth and admin protection (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeEach(async () => {
    ({ app, jwtService } = await createTestApp({
      app: { enableApiKeyAuth: true },
      auth: { allowedAdminEmails: ['admin@example.com'] },
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects auth/me without credentials', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('allows local dev login when enabled', async () => {
    const devApp = await createTestApp({
      app: { enableApiKeyAuth: true },
      auth: { allowedAdminEmails: ['admin@example.com'], enableDevLogin: true },
    });

    const agent = request.agent(devApp.app.getHttpServer());
    const loginResponse = await agent
      .post('/auth/dev/login')
      .send({ email: 'admin@example.com', name: 'Dev Admin' })
      .expect(200);

    expect(loginResponse.body.user.email).toBe('admin@example.com');

    const meResponse = await agent.get('/auth/me').expect(200);
    expect(meResponse.body.user.name).toBe('Dev Admin');

    await devApp.app.close();
  });

  it('returns auth/me for a valid bearer token', async () => {
    const token = await jwtService.signAsync({
      sub: 'google:user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      provider: 'google',
      providerUserId: 'user-1',
      isAdmin: true,
    });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.user.email).toBe('admin@example.com');
    expect(response.body.user.isAdmin).toBe(true);
  });

  it('rejects protected documents route without auth', async () => {
    await request(app.getHttpServer()).get('/documents').expect(401);
  });

  it('allows protected documents route with legacy api key', async () => {
    await request(app.getHttpServer()).get('/documents').set('X-API-Key', 'test-api-key').expect(200);
  });

  it('allows protected admin overview route with jwt', async () => {
    const token = await jwtService.signAsync({
      sub: 'github:user-2',
      email: 'admin@example.com',
      name: 'Admin User',
      provider: 'github',
      providerUserId: 'user-2',
      isAdmin: true,
    });

    const response = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.health.status).toBe('ok');
    expect(response.body.documents.total).toBe(0);
  });
});
