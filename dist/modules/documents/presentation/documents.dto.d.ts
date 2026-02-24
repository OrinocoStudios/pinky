import { DocumentRecord } from '../domain/models/document.model';
export declare class IngestTextDocumentDto {
    title?: string;
    rawText: string;
    source?: DocumentRecord['source'];
    metadata?: Record<string, unknown>;
}
export declare class UploadDocumentDto {
    title?: string;
    metadata?: Record<string, unknown>;
}
export declare class GenerateDocumentDto {
    useCaseId: string;
    title?: string;
    params?: Record<string, unknown>;
}
