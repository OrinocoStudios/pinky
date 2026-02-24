import { FileTextExtractorPort, UploadedFileInput } from '../../domain/ports/file-text-extractor.port';
export declare class DefaultFileTextExtractorAdapter implements FileTextExtractorPort {
    extract(file: UploadedFileInput): Promise<string>;
    private extractPdf;
    private extractDocx;
}
