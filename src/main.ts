import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BrainConfig, validateProductionConfig } from './config/configuration';
import { StructuredLogger } from './common/logger/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService<BrainConfig>);
  const jwtService = app.get(JwtService);
  app.useLogger(app.get(StructuredLogger));

  const fullConfig: BrainConfig = {
    app: configService.get('app', { infer: true })!,
    auth: configService.get('auth', { infer: true })!,
    neo4j: configService.get('neo4j', { infer: true })!,
    llm: configService.get('llm', { infer: true })!,
    ollama: configService.get('ollama', { infer: true })!,
  };
  validateProductionConfig(fullConfig);

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.use('/metrics', async (request: Request, response: Response, next: NextFunction) => {
    const authConfig = configService.get('auth', { infer: true });
    const appConfig = configService.get('app', { infer: true })!;
    const webAuthEnabled = Boolean(authConfig?.allowedAdminEmails?.length);

    if (!webAuthEnabled && !appConfig.enableApiKeyAuth) {
      next();
      return;
    }

    const cookieToken = request.cookies?.[authConfig?.cookieName ?? 'pinky_auth'];
    const authorizationHeader = typeof request.headers.authorization === 'string' ? request.headers.authorization : '';
    const bearerToken = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : null;
    const apiKey = typeof request.headers['x-api-key'] === 'string' ? request.headers['x-api-key'] : null;

    try {
      if (cookieToken || bearerToken) {
        await jwtService.verifyAsync(cookieToken ?? bearerToken ?? '', {
          secret: authConfig?.jwtSecret,
        });
        next();
        return;
      }

      if (appConfig.enableApiKeyAuth && apiKey === appConfig.apiKey) {
        next();
        return;
      }

      response.status(401).json({ message: 'Authentication is required' });
    } catch {
      response.status(401).json({ message: 'Invalid authentication token' });
    }
  });

  const corsEnabled = configService.get('app.corsEnabled', { infer: true }) ?? false;
  const corsOrigins = configService.get('app.corsOrigins', { infer: true }) ?? [];
  if (corsEnabled) {
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id', 'X-Library-Id'],
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Body size limits
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

  const port = configService.get('app.port', { infer: true }) ?? 8081;
  await app.listen(port);
}

bootstrap().catch((error) => {
  // Fatal boot errors must be visible in logs before the supervisor restarts us.
  console.error('Fatal bootstrap error', error);
  process.exit(1);
});
