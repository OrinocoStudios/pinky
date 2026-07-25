import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../application/generate-document.usecase';
import { DocumentRecord } from '../domain/models/document.model';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { DOCUMENT_REPOSITORY, FILE_TEXT_EXTRACTOR_PORT } from '../../../shared/di.tokens';
import { GenerateDocumentDto, IngestTextDocumentDto, UploadDocumentDto } from './documents.dto';
import { FileTextExtractorPort } from '../../ingestion/domain/ports/file-text-extractor.port';
import { RequireApiKey } from '../../../common/decorators/require-api-key.decorator';
import { CurrentPrincipal } from '../../../common/decorators/current-principal.decorator';
import { ApiPrincipal } from '../../../common/security/api-principal';
import { RequestScope, resolveRequestScope } from '../../../common/security/request-scope';
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
  @SkipThrottle({ default: true, query: true, upload: true })
  @Throttle({ ingest: {} })
  @RequireApiKey()
  async ingestText(
    @Body() body: IngestTextDocumentDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
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
  @SkipThrottle({ default: true, query: true, upload: true })
  @Throttle({ ingest: {} })
  @RequireApiKey()
  async generateDocument(
    @Body() body: GenerateDocumentDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    if (!body.useCaseId?.trim()) {
      throw new BadRequestException('useCaseId is required');
    }
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
    return this.generateDocumentUseCase.execute({
      tenantId,
      libraryId,
      useCaseId: body.useCaseId,
      title: body.title,
      params: body.params,
    });
  }

  @Post('upload')
  @SkipThrottle({ default: true, query: true, ingest: true })
  @Throttle({ upload: {} })
  @RequireApiKey()
  @UseInterceptors(FileUploadInterceptor)
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadDocumentDto,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const extracted = await this.fileTextExtractor.extract(file);
    if (!extracted.trim()) {
      throw new BadRequestException('Unable to extract text from uploaded file');
    }

    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
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
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @Throttle({ default: {} })
  @RequireApiKey()
  async listDocuments(
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
    @Query('page') pageQuery?: string,
    @Query('pageSize') pageSizeQuery?: string,
  ) {
    const page = this.parsePositiveInteger(pageQuery, 1);
    const pageSize = this.parsePositiveInteger(pageSizeQuery, 24, 200);
    const offset = (page - 1) * pageSize;
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
    const total = await this.documentRepository.countDocuments(tenantId, libraryId);

    let documents: DocumentRecord[] = [];
    if (tenantId) {
      documents = await this.documentRepository.listDocumentsByTenant(tenantId, pageSize, libraryId, offset);
    } else if (libraryId) {
      documents = await this.documentRepository.listDocumentsByLibrary(libraryId, undefined, pageSize, offset);
    } else {
      documents = await this.documentRepository.listDocuments(pageSize, libraryId, offset);
    }

    return {
      items: documents.map((document) => this.toDocumentSummary(document)),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  @Get('scopes')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @Throttle({ default: {} })
  @RequireApiKey()
  async listDocumentScopes() {
    return this.documentRepository.listDocumentScopes();
  }

  @Get(':id')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @Throttle({ default: {} })
  @RequireApiKey()
  async getDocument(
    @Param('id') documentId: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
    const document = await this.documentRepository.findDocumentById(documentId);
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (tenantId && document.tenantId !== tenantId) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (libraryId && document.libraryId !== libraryId) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return document;
  }

  @Delete(':id')
  @SkipThrottle({ query: true, upload: true, ingest: true })
  @RequireApiKey()
  async deleteDocument(
    @Param('id') documentId: string,
    @Headers('x-tenant-id') tenantHeader?: string,
    @Headers('x-library-id') libraryHeader?: string,
    @CurrentPrincipal() principal?: ApiPrincipal,
  ) {
    const { tenantId, libraryId } = this.resolveScope(principal, tenantHeader, libraryHeader);
    await this.deleteDocumentUseCase.execute(documentId, tenantId, libraryId);
    return { deleted: documentId };
  }

  private resolveScope(
    principal: ApiPrincipal | undefined,
    tenantHeader?: string,
    libraryHeader?: string,
  ): RequestScope {
    return resolveRequestScope({
      principal,
      tenantHeader,
      libraryHeader,
      enableMultiTenant: this.configService.get('app.enableMultiTenant', { infer: true }) ?? false,
    });
  }


  private toDocumentSummary(document: DocumentRecord): Omit<DocumentRecord, 'rawText'> & { previewText?: string } {
    const { rawText, ...summary } = document;
    const previewText = rawText?.replace(/\s+/g, ' ').trim().slice(0, 240);
    return {
      ...summary,
      previewText: previewText && previewText.length > 0 ? previewText : undefined,
    };
  }

  private parsePositiveInteger(rawValue: string | undefined, fallback: number, max?: number): number {
    if (!rawValue) {
      return fallback;
    }
    const parsedValue = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return fallback;
    }
    if (max && parsedValue > max) {
      return max;
    }
    return parsedValue;
  }
}
