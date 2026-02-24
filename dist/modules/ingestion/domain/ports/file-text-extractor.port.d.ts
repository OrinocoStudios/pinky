export type UploadedFileInput = {
    buffer?: Buffer;
    mimetype?: string;
    originalname?: string;
};
export interface FileTextExtractorPort {
    extract(file: UploadedFileInput): Promise<string>;
}
