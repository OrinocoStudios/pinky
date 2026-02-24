import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import multer from 'multer';
import { BrainConfig } from '../../config/configuration';

const DEFAULT_ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService<BrainConfig>) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<ReturnType<CallHandler['handle']>> {
    const allowedMimeTypes = this.getAllowedMimeTypes();
    const maxFileSize = this.getMaxFileSize();

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxFileSize },
      fileFilter: (
        _req: Express.Request,
        file: Express.Multer.File,
        callback: multer.FileFilterCallback,
      ) => {
        if (!file?.mimetype) {
          callback(null, false);
          return;
        }
        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
            ),
          );
        }
      },
    });

    const ctx = context.switchToHttp();
    await new Promise<void>((resolve, reject) => {
      upload.single('file')(ctx.getRequest(), ctx.getResponse(), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return next.handle();
  }

  private getAllowedMimeTypes(): string[] {
    const allowedMimeTypes = this.configService.get<string[] | string>('app.allowedMimeTypes', {
      infer: true,
    });
    if (Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0) {
      return allowedMimeTypes;
    }
    if (typeof allowedMimeTypes === 'string' && allowedMimeTypes.trim().length > 0) {
      return allowedMimeTypes.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return DEFAULT_ALLOWED_MIME_TYPES;
  }

  private getMaxFileSize(): number {
    const maxFileSizeMB = this.configService.get<number>('app.maxFileSizeMB', { infer: true });
    if (maxFileSizeMB) {
      return maxFileSizeMB * 1024 * 1024;
    }
    return DEFAULT_MAX_FILE_SIZE;
  }
}
