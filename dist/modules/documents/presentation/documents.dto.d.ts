declare abstract class DocumentSourceBaseDto {
    kind: 'upload' | 'url' | 'generated';
}
export declare class DocumentSourceUploadDto extends DocumentSourceBaseDto {
    kind: 'upload';
    filename: string;
    mimeType: string;
}
export declare class DocumentSourceUrlDto extends DocumentSourceBaseDto {
    kind: 'url';
    url: string;
}
export declare class DocumentSourceGeneratedDto extends DocumentSourceBaseDto {
    kind: 'generated';
    useCaseId: string;
}
export type DocumentSourceDto = DocumentSourceUploadDto | DocumentSourceUrlDto | DocumentSourceGeneratedDto;
export declare class IngestTextDocumentDto {
    title?: string;
    rawText: string;
    source?: DocumentSourceDto;
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
export {};
