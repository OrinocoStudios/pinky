import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { BrainConfig } from '../../../config/configuration';
import { DocumentChunk } from '../../documents/domain/models/document.model';

@Injectable()
export class SimpleChunkerService {
  constructor(private readonly configService: ConfigService<BrainConfig>) {}

  chunk(documentId: string, text: string): DocumentChunk[] {
    const chunkSize = this.configService.get<number>('app.chunkSize', { infer: true }) ?? 1200;
    const chunkOverlap = this.configService.get<number>('app.chunkOverlap', { infer: true }) ?? 200;
    const safeOverlap = Math.max(0, Math.min(chunkOverlap, Math.floor(chunkSize / 2)));
    const step = Math.max(1, chunkSize - safeOverlap);

    const chunks: DocumentChunk[] = [];
    const createdAt = new Date().toISOString();
    let seq = 0;

    for (let i = 0; i < text.length; i += step) {
      const end = Math.min(i + chunkSize, text.length);
      const slice = text.slice(i, end).trim();
      if (!slice) {
        continue;
      }

      chunks.push({
        chunkId: randomUUID(),
        documentId,
        seq: seq++,
        text: slice,
        startOffset: i,
        endOffset: end,
        createdAt,
      });

      if (end >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
