import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { BrainConfig } from '../../../config/configuration';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly configService: ConfigService<BrainConfig>,
    private readonly ingestDocumentUseCase: IngestDocumentUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
    private readonly generateDocumentUseCase: GenerateDocumentUseCase,
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: DocumentRepositoryPort,
    @Inject(FILE_TEXT_EXTRACTOR_PORT)
    private readonly fileTextExtractor: FileTextExtractorPort,
    private readonly logger: StructuredLogger,
  ) {}

  @Post('text')
  @RequireApiKey()
  async ingestText(
    @Body() body: IngestTextDocumentDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    return this.ingestDocumentUseCase.execute({
      tenantId,
      libraryId,
      title: body.title,
      rawText: body.rawText,
      source: body.source ?? { kind: 'generated', useCaseId: 'manual-api-text' },
      metadata: body.metadata,
    });
  }

  @Post('generate')
  @RequireApiKey()
  async generateDocument(
    @Body() body: GenerateDocumentDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    if (!body.useCaseId?.trim()) {
      throw new BadRequestException('useCaseId is required');
    }
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    return this.generateDocumentUseCase.execute({
      tenantId,
      libraryId,
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
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const extracted = await this.fileTextExtractor.extract(file);
    if (!extracted.trim()) {
      throw new BadRequestException('Unable to extract text from uploaded file');
    }

    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    return this.ingestDocumentUseCase.execute({
      tenantId,
      libraryId,
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
  @RequireApiKey()
  async listDocuments(
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    if (tenantId) {
      return this.documentRepository.listDocumentsByTenant(tenantId, 100, libraryId);
    }
    if (libraryId) {
      return this.documentRepository.listDocumentsByLibrary(libraryId, undefined, 100);
    }
    return this.documentRepository.listDocuments(100, libraryId);
  }

  @Delete(':id')
  @RequireApiKey()
  async deleteDocument(
    @Param('id') documentId: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
  ) {
    const tenantId = this.resolveTenantId(tenantHeader);
    const libraryId = this.resolveLibraryId(libraryHeader);
    await this.deleteDocumentUseCase.execute(documentId, tenantId, libraryId);
    return { deleted: documentId };
  }

  private resolveTenantId(rawTenantId?: string): string | undefined {
    const enableMultiTenant = this.configService.get('app.enableMultiTenant', { infer: true }) ?? false;
    const tenantId = rawTenantId?.trim();
    if (enableMultiTenant && !tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required when ENABLE_MULTI_TENANT=true');
    }
    return tenantId;
  }

  private resolveLibraryId(rawLibraryId?: string): string | undefined {
    const libraryId = rawLibraryId?.trim();
    return libraryId && libraryId.length > 0 ? libraryId : undefined;
  }
}
