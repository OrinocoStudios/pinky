import { DocumentGeneratorPort } from '../domain/ports/document-generator.port';
import { DocumentRecord } from '../domain/models/document.model';
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';
export type GenerateDocumentInput = {
    useCaseId: string;
    title?: string;
    params?: Record<string, unknown>;
};
export declare class GenerateDocumentUseCase {
    private readonly documentGenerator;
    private readonly ingestDocumentUseCase;
    constructor(documentGenerator: DocumentGeneratorPort, ingestDocumentUseCase: IngestDocumentUseCase);
    execute(input: GenerateDocumentInput): Promise<DocumentRecord>;
}
