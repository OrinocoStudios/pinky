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
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../application/generate-document.usecase';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { DOCUMENT_REPOSITORY, FILE_TEXT_EXTRACTOR_PORT } from '../../../shared/di.tokens';
import { GenerateDocumentDto, IngestTextDocumentDto, UploadDocumentDto } from './documents.dto';
import { FileTextExtractorPort } from '../../ingestion/domain/ports/file-text-extractor.port';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { FileUploadInterceptor } from '../../../common/interceptors/file-upload.interceptor';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly ingestDocumentUseCase: IngestDocumentUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
    private readonly generateDocumentUseCase: GenerateDocumentUseCase,
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(FILE_TEXT_EXTRACTOR_PORT)
    private readonly fileTextExtractor: FileTextExtractorPort,
  ) {}

  @Post('text')
  @RequireApiKey()
  async ingestText(@Body() body: IngestTextDocumentDto) {
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
  @Throttle({ upload: {} })
  @RequireApiKey()
  @UseInterceptors(FileUploadInterceptor)
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const extracted = await this.fileTextExtractor.extract(file);
    if (!extracted.trim()) {
      throw new BadRequestException('Unable to extract text from uploaded file');
    }

    return this.ingestDocumentUseCase.execute({
      title: body.title ?? file.originalname ?? 'uploaded-file',
      rawText: extracted,
      source: {
        kind: 'upload',
        filename: file.originalname ?? 'uploaded-file',
        mimeType: file.mimetype ?? 'application/octet-stream',
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
