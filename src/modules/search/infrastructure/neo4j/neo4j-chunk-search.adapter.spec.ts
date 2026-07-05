import { Neo4jChunkSearchAdapter } from './neo4j-chunk-search.adapter';
import { Neo4jConnectionService } from '../../../graph/infrastructure/neo4j/neo4j-connection.service';
import { EmbeddingPort } from '../../../ingestion/domain/ports/embedding.port';

type RecordShape = Record<string, unknown>;

function makeRecord(values: RecordShape) {
  return { get: (key: string) => values[key] };
}

describe('Neo4jChunkSearchAdapter', () => {
  let run: jest.Mock;
  let adapter: Neo4jChunkSearchAdapter;

  const baseRecord: RecordShape = {
    chunkId: 'c1',
    documentId: 'd1',
    tenantId: null,
    libraryId: 'lib-1',
    seq: 0,
    text: 'chunk text',
    embedding: null,
    embeddingModel: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    run = jest.fn();
    const neo4j = {
      getSession: () => ({ run, close: jest.fn().mockResolvedValue(undefined) }),
    } as unknown as Neo4jConnectionService;
    const embeddingPort: EmbeddingPort = {
      embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    } as unknown as EmbeddingPort;
    adapter = new Neo4jChunkSearchAdapter(neo4j, embeddingPort);
  });

  it('propagates the vector score when the driver returns a native float', async () => {
    run.mockResolvedValue({ records: [makeRecord({ ...baseRecord, score: 0.91 })] });

    const chunks = await adapter.hybridSearch({ queryText: 'q', topK: 4 });

    expect(chunks[0].score).toBe(0.91);
  });

  it('propagates the vector score when the driver returns a Neo4j Integer-like value', async () => {
    run.mockResolvedValue({
      records: [makeRecord({ ...baseRecord, score: { toNumber: () => 1 } })],
    });

    const chunks = await adapter.hybridSearch({ queryText: 'q', topK: 4 });

    expect(chunks[0].score).toBe(1);
  });

  it('leaves score undefined when the record has no score', async () => {
    run.mockResolvedValue({ records: [makeRecord({ ...baseRecord, score: null })] });

    const chunks = await adapter.hybridSearch({ queryText: 'q', topK: 4 });

    expect(chunks[0].score).toBeUndefined();
  });
});
