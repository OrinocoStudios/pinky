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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = 500;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let stack = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message?: string | string[] }).message ?? exception.message);

      error =
        typeof exceptionResponse === 'object' && exceptionResponse !== null && 'error' in exceptionResponse
          ? String((exceptionResponse as { error?: unknown }).error ?? exception.name)
          : exception.name;
      stack = exception.stack;
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
      stack = exception.stack;
    } else {
      message = String(exception);
    }

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
      this.logger.error(JSON.stringify(logPayload), stack);
    } else {
      this.logger.warn(JSON.stringify(logPayload));
    }

    response.status(statusCode).json(body);
  }
}
