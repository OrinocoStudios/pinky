import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class ChecksumService {
  calculate(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
