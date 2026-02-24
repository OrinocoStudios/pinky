import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../application/generate-document.usecase';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { DOCUMENT_REPOSITORY, FILE_TEXT_EXTRACTOR_PORT } from '../../../shared/di.tokens';
import { GenerateDocumentDto, IngestTextDocumentDto, UploadDocumentDto } from './documents.dto';
import { FileTextExtractorPort } from '../../ingestion/domain/ports/file-text-extractor.port';
import { BrainConfig } from '../../../config/configuration';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';

@Controller('documents')
export class DocumentsController {
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB default
  private allowedMimeTypes: string[] = [
    'text/plain',
    'text/markdown',
    'application/json',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  constructor(
    private readonly ingestDocumentUseCase: IngestDocumentUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
    private readonly generateDocumentUseCase: GenerateDocumentUseCase,
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(FILE_TEXT_EXTRACTOR_PORT)
    private readonly fileTextExtractor: FileTextExtractorPort,
    private readonly configService: ConfigService<BrainConfig>,
  ) {
    // Initialize defaults first
    this.maxFileSize = 10 * 1024 * 1024; // 10MB default
    this.allowedMimeTypes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    // Override from config if available
    const appConfig = this.configService.get('app', { infer: true });
    if (appConfig) {
      if (appConfig.maxFileSizeMB) {
        this.maxFileSize = appConfig.maxFileSizeMB * 1024 * 1024;
      }
      if (appConfig.allowedMimeTypes && appConfig.allowedMimeTypes.length > 0) {
        this.allowedMimeTypes = appConfig.allowedMimeTypes;
      }
    }
  }

  @Post('text')
  @RequireApiKey()
  async ingestText(@Body() body: IngestTextDocumentDto) {
    if (!body.rawText?.trim()) {
      throw new BadRequestException('rawText is required');
    }

    return this.ingestDocumentUseCase.execute({
      title: body.title,
      rawText: body.rawText,
      source: body.source ?? { kind: 'generated', useCaseId: 'manual-api-text' },
      metadata: body.metadata,
    });
  }

  @Post('generate')
  @RequireApiKey()
  async generateDocument(@Body() body: GenerateDocumentDto) {
    if (!body.useCaseId?.trim()) {
      throw new BadRequestException('useCaseId is required');
    }
    return this.generateDocumentUseCase.execute({
      useCaseId: body.useCaseId,
      title: body.title,
      params: body.params,
    });
  }

  @Post('upload')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @RequireApiKey()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
      fileFilter: (req: any, file: any, callback: (error: any, acceptFile: boolean) => void) => {
        if (!file?.mimetype) {
          callback(null, false);
          return;
        }
        const allowed = this.allowedMimeTypes!;
        if (allowed.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException(`File type not allowed. Allowed types: ${allowed.join(', ') ?? 'none'}`), false);
        }
      },
    }),
  )
  async uploadDocument(@UploadedFile() file: any, @Body() body: UploadDocumentDto) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const extracted = await this.fileTextExtractor.extract(file);
    if (!extracted.trim()) {
      throw new BadRequestException('Unable to extract text from uploaded file');
    }

    return this.ingestDocumentUseCase.execute({
      title: body.title ?? file.originalname,
      rawText: extracted,
      source: {
        kind: 'upload',
        filename: file.originalname,
        mimeType: file.mimetype,
      },
      metadata: {
        ...(body.metadata ?? {}),
        size: file.size,
      },
    });
  }

  @Get()
  async listDocuments() {
    return this.documentRepository.listDocuments(100);
  }

  @Delete(':id')
  @RequireApiKey()
  async deleteDocument(@Param('id') documentId: string) {
    await this.deleteDocumentUseCase.execute(documentId);
    return { deleted: documentId };
  }
}
