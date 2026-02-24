import { Injectable } from '@nestjs/common';
import { FileTextExtractorPort, UploadedFileInput } from '../../domain/ports/file-text-extractor.port';

@Injectable()
export class DefaultFileTextExtractorAdapter implements FileTextExtractorPort {
  async extract(file: UploadedFileInput): Promise<string> {
    if (!file.buffer) {
      return '';
    }

    const mimetype = (file.mimetype ?? '').toLowerCase();
    const name = (file.originalname ?? '').toLowerCase();

    if (mimetype.includes('application/pdf') || name.endsWith('.pdf')) {
      return this.extractPdf(file.buffer);
    }

    if (
      mimetype.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      name.endsWith('.docx')
    ) {
      return this.extractDocx(file.buffer);
    }

    return file.buffer.toString('utf-8');
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const parsed = await pdfParse(buffer);
    return parsed.text ?? '';
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammothModule = await import('mammoth');
    const mammoth = (mammothModule as any).default ?? mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? '';
  }
}
