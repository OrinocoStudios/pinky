import { Injectable } from '@nestjs/common';
import { DocumentChunk } from '../../../documents/domain/models/document.model';
import { ChunkSearchPort, ChunkSearchQuery } from '../../domain/ports/chunk-search.port';

@Injectable()
export class ElasticsearchChunkSearchAdapter implements ChunkSearchPort {
  async hybridSearch(_query: ChunkSearchQuery): Promise<DocumentChunk[]> {
    return [];
  }
}
