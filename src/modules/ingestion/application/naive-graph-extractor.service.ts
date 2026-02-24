import { Injectable } from '@nestjs/common';
import { ExtractedGraph, GraphEntity, GraphRelationship } from '../../graph/domain/models/graph.model';

@Injectable()
export class NaiveGraphExtractorService {
  extract(documentId: string, text: string): ExtractedGraph {
    const entityPattern = /\b([A-Z][a-zA-Z]{2,})\b/g;
    const matches = Array.from(text.matchAll(entityPattern)).map((m) => m[1]);
    const uniqueNames = [...new Set(matches)].slice(0, 30);

    const entities: GraphEntity[] = uniqueNames.map((name) => ({
      entityId: `${name.toLowerCase()}::${documentId}`,
      type: 'NamedEntity',
      name,
      normalized: name.toLowerCase(),
      attributes: { sourceDocumentId: documentId },
    }));

    const relationships: GraphRelationship[] = [];
    for (let i = 0; i < entities.length - 1; i++) {
      relationships.push({
        fromEntityId: entities[i].entityId,
        toEntityId: entities[i + 1].entityId,
        type: 'RELATED_TO',
        confidence: 0.5,
        sourceChunkId: 'document-level',
      });
    }

    return {
      sourceDocumentId: documentId,
      entities,
      relationships,
    };
  }
}
