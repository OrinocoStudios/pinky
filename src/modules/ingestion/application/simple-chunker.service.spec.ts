import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SimpleChunkerService } from './simple-chunker.service';

describe('SimpleChunkerService', () => {
  let chunker: SimpleChunkerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SimpleChunkerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'app.chunkSize') return 100;
              if (key === 'app.chunkOverlap') return 20;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    chunker = module.get(SimpleChunkerService);
  });

  it('should return empty array for empty text', () => {
    const result = chunker.chunk('doc-1', '');
    expect(result).toEqual([]);
  });

  it('should return single chunk for short text', () => {
    const text = 'Short text.';
    const result = chunker.chunk('doc-1', text);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
    expect(result[0].documentId).toBe('doc-1');
    expect(result[0].seq).toBe(0);
  });

  it('should split long text into overlapping chunks', () => {
    const text = 'A'.repeat(250);
    const result = chunker.chunk('doc-1', text);

    expect(result.length).toBeGreaterThan(1);

    // Check sequential numbering
    result.forEach((chunk, i) => {
      expect(chunk.seq).toBe(i);
      expect(chunk.documentId).toBe('doc-1');
      expect(chunk.chunkId).toBeDefined();
    });

    // Check overlap: second chunk should start before first chunk ends
    expect(result[1].startOffset!).toBeLessThan(result[0].endOffset!);
  });

  it('should assign unique chunkIds', () => {
    const text = 'A'.repeat(500);
    const result = chunker.chunk('doc-1', text);
    const ids = result.map((c) => c.chunkId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should cover the entire text', () => {
    const text = 'Word '.repeat(100);
    const result = chunker.chunk('doc-1', text);
    const lastChunk = result[result.length - 1];
    expect(lastChunk.endOffset).toBe(text.length);
  });
});
