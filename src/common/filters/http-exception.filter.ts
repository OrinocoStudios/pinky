import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ErrorResponseShape = {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] }).message ?? exception.message);

    const error =
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'error' in exceptionResponse
        ? String((exceptionResponse as { error?: unknown }).error ?? exception.name)
        : exception.name;

    const body: ErrorResponseShape = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const logPayload = {
      statusCode,
      method: request.method,
      path: request.url,
      message,
      error,
    };

    if (statusCode >= 500) {
      this.logger.error(logPayload, exception.stack);
    } else {
      this.logger.warn(logPayload);
    }

    response.status(statusCode).json(body);
  }
}
