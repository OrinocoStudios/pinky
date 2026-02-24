import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import * as multer from 'multer';
import { BrainConfig } from '../../config/configuration';

const DEFAULT_ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class DocumentUploadInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService<BrainConfig>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rawAllowed =
      this.configService.get<string | string[]>('app.allowedMimeTypes', { infer: true });
    const allowed: string[] = Array.isArray(rawAllowed)
      ? rawAllowed
      : rawAllowed
        ? [rawAllowed]
        : DEFAULT_ALLOWED_MIME_TYPES;
    const maxSizeMB =
      this.configService.get<number>('app.maxFileSizeMB', { infer: true }) ?? 10;
    const maxFileSize = maxSizeMB * 1024 * 1024;

    const multerMiddleware = multer({
      limits: { fileSize: maxFileSize },
      fileFilter: (
        _req: Express.Request,
        file: Express.Multer.File,
        callback: (error: Error | null, acceptFile?: boolean) => void,
      ) => {
        if (!file?.mimetype) {
          callback(null, false);
          return;
        }
        if (allowed.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `File type not allowed. Allowed types: ${allowed.join(', ') || 'none'}`,
            ),
            false,
          );
        }
      },
    }).single('file');

    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    return from(
      new Promise<void>((resolve, reject) => {
        multerMiddleware(req, res, (err: unknown) => {
          if (err) {
            reject(
              err instanceof HttpException
                ? err
                : err instanceof Error && err.message === 'File too large'
                  ? new PayloadTooLargeException(err.message)
                  : new BadRequestException(
                      err instanceof Error ? err.message : 'Upload failed',
                    ),
            );
          } else {
            resolve();
          }
        });
      }),
    ).pipe(switchMap(() => next.handle()));
  }
}
