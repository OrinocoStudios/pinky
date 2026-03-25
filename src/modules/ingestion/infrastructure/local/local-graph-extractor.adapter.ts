import { Injectable } from '@nestjs/common';
import { ExtractedGraph } from '../../../graph/domain/models/graph.model';
import { GraphExtractorPort } from '../../domain/ports/graph-extractor.port';

@Injectable()
export class LocalGraphExtractorAdapter implements GraphExtractorPort {
  async extract(documentId: string, chunks: { chunkId: string; text: string }[]): Promise<ExtractedGraph> {
    // Return a dummy empty graph for local mode
    return {
      entities: [],
      relationships: [],
    };
  }

  getModelId(): string {
    return 'local-mock-extractor';
  }
}
