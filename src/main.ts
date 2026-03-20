import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BrainConfig } from './config/configuration';
import { StructuredLogger } from './common/logger/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<BrainConfig>);
  app.useLogger(app.get(StructuredLogger));

  const corsEnabled = configService.get('app.corsEnabled', { infer: true }) ?? false;
  const corsOrigins = configService.get('app.corsOrigins', { infer: true }) ?? [];
  if (corsEnabled) {
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-API-Key'],
      credentials: false,
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
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

  const port = configService.get('app.port', { infer: true }) ?? 8081;
  await app.listen(port);
}

bootstrap();
