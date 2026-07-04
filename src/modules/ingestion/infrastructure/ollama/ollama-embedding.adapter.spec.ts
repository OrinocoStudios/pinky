import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddingAdapter } from './ollama-embedding.adapter';

describe('OllamaEmbeddingAdapter', () => {
  const configService = {
    get: jest.fn().mockReturnValue({
      baseUrl: 'http://embed-host:11434',
      embeddingModel: 'nomic-embed-text-v1.5.Q5_K_M.gguf',
      timeoutMs: 5000,
    }),
  } as unknown as ConfigService;

  let adapter: OllamaEmbeddingAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    adapter = new OllamaEmbeddingAdapter(configService);
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[3, 4]] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function sentInput(): string {
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    return body.input;
  }

  it('sends search_document prefix when embedding documents (default task)', async () => {
    await adapter.embed('Lyme disease chunk');
    expect(sentInput()).toBe('search_document: Lyme disease chunk');
  });

  it('sends search_query prefix when embedding queries', async () => {
    await adapter.embed('what is Lyme disease', 'query');
    expect(sentInput()).toBe('search_query: what is Lyme disease');
  });

  it('returns the normalized vector', async () => {
    const vector = await adapter.embed('text');
    expect(vector).toEqual([0.6, 0.8]);
  });

  it('throws instead of returning a fake vector when the endpoint fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(adapter.embed('text')).rejects.toThrow('Ollama embed failed (500)');
  });
});
