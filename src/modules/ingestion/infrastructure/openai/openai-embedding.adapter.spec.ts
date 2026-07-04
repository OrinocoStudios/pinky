import { ConfigService } from '@nestjs/config';
import { OpenAiEmbeddingAdapter } from './openai-embedding.adapter';
import { createOpenAiClient } from '../../../../common/utils/openai-client';

jest.mock('../../../../common/utils/openai-client', () => ({
  createOpenAiClient: jest.fn(),
}));

describe('OpenAiEmbeddingAdapter', () => {
  const embeddingsCreate = jest.fn();

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'llm.openai') {
        return { apiKey: 'test-key', baseUrl: 'http://embed-host:8080/v1' };
      }
      if (key === 'llm.openai.embeddingModel') {
        return 'nomic-embed-text-v1.5.Q5_K_M.gguf';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  let adapter: OpenAiEmbeddingAdapter;

  beforeEach(() => {
    embeddingsCreate.mockReset();
    embeddingsCreate.mockResolvedValue({ data: [{ embedding: [3, 4] }] });
    (createOpenAiClient as jest.Mock).mockReturnValue({
      embeddings: { create: embeddingsCreate },
    });
    adapter = new OpenAiEmbeddingAdapter(configService);
  });

  it('sends search_document prefix when embedding documents (default task)', async () => {
    await adapter.embed('Lyme disease chunk');
    expect(embeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'search_document: Lyme disease chunk' }),
    );
  });

  it('sends search_query prefix when embedding queries', async () => {
    await adapter.embed('what is Lyme disease', 'query');
    expect(embeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'search_query: what is Lyme disease' }),
    );
  });

  it('returns the normalized vector', async () => {
    const vector = await adapter.embed('text');
    expect(vector).toEqual([0.6, 0.8]);
  });

  it('throws instead of returning a fake vector when the endpoint fails', async () => {
    embeddingsCreate.mockRejectedValue(new Error('connection refused'));
    await expect(adapter.embed('text')).rejects.toThrow('connection refused');
  });
});
