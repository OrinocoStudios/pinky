import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { BrainConfig } from '../../config/configuration';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly configService: ConfigService<BrainConfig>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProd = this.configService.get('app.env', { infer: true }) === 'production';

    let status: number;
    let message: string;
    let errorDetail: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const rawMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string | string[] }).message ?? exception.message;
      message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;
      errorDetail = typeof exceptionResponse === 'object' ? exceptionResponse : undefined;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = isProd
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Unknown error';
      errorDetail = isProd ? undefined : exception instanceof Error ? exception.stack : String(exception);

      if (status >= 500) {
        this.logger.error(
          `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
          exception instanceof Error ? exception.stack : undefined,
        );
      }
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (errorDetail !== undefined) {
      body.error = errorDetail;
    }

    response.status(status).json(body);
  }
}
