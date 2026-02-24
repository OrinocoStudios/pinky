import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../application/generate-document.usecase';
import { DocumentRepositoryPort } from '../domain/ports/document-repository.port';
import { GenerateDocumentDto, IngestTextDocumentDto, UploadDocumentDto } from './documents.dto';
import { FileTextExtractorPort } from '../../ingestion/domain/ports/file-text-extractor.port';
export declare class DocumentsController {
    private readonly ingestDocumentUseCase;
    private readonly deleteDocumentUseCase;
    private readonly generateDocumentUseCase;
    private readonly documentRepository;
    private readonly fileTextExtractor;
    constructor(ingestDocumentUseCase: IngestDocumentUseCase, deleteDocumentUseCase: DeleteDocumentUseCase, generateDocumentUseCase: GenerateDocumentUseCase, documentRepository: DocumentRepositoryPort, fileTextExtractor: FileTextExtractorPort);
    ingestText(body: IngestTextDocumentDto): Promise<import("../domain/models/document.model").DocumentRecord>;
    generateDocument(body: GenerateDocumentDto): Promise<import("../domain/models/document.model").DocumentRecord>;
    uploadDocument(file: Express.Multer.File | undefined, body: UploadDocumentDto): Promise<import("../domain/models/document.model").DocumentRecord>;
    listDocuments(): Promise<import("../domain/models/document.model").DocumentRecord[]>;
    deleteDocument(documentId: string): Promise<{
        deleted: string;
    }>;
}
