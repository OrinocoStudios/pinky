import { ConfigService } from '@nestjs/config';
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../application/generate-document.usecase';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { GenerateDocumentDto, IngestTextDocumentDto, UploadDocumentDto } from './documents.dto';
import { FileTextExtractorPort } from '../../ingestion/domain/ports/file-text-extractor.port';
import { BrainConfig } from '../../../config/configuration';
export declare class DocumentsController {
    private readonly ingestDocumentUseCase;
    private readonly deleteDocumentUseCase;
    private readonly generateDocumentUseCase;
    private readonly documentRepository;
    private readonly fileTextExtractor;
    private readonly configService;
    private maxFileSize;
    private allowedMimeTypes;
    constructor(ingestDocumentUseCase: IngestDocumentUseCase, deleteDocumentUseCase: DeleteDocumentUseCase, generateDocumentUseCase: GenerateDocumentUseCase, documentRepository: DocumentRepositoryPort, fileTextExtractor: FileTextExtractorPort, configService: ConfigService<BrainConfig>);
    ingestText(body: IngestTextDocumentDto): Promise<import("../domain/models/document.model").DocumentRecord>;
    generateDocument(body: GenerateDocumentDto): Promise<import("../domain/models/document.model").DocumentRecord>;
    uploadDocument(file: any, body: UploadDocumentDto): Promise<import("../domain/models/document.model").DocumentRecord>;
    listDocuments(): Promise<import("../domain/models/document.model").DocumentRecord[]>;
    deleteDocument(documentId: string): Promise<{
        deleted: string;
    }>;
}
