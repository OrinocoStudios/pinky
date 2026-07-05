import { ChunkScoreFilterService } from './chunk-score-filter.service';

type Chunk = { chunkId: string; score?: number };

describe('ChunkScoreFilterService', () => {
  const service = new ChunkScoreFilterService();

  const chunk = (chunkId: string, score?: number): Chunk => ({ chunkId, score });

  it('keeps chunks within the relative margin of the best score', () => {
    const chunks = [chunk('a', 0.91), chunk('b', 0.9), chunk('c', 0.84)];

    const kept = service.filter(chunks, { relativeMargin: 0.05, minScore: 0 });

    expect(kept.map((c) => c.chunkId)).toEqual(['a', 'b']);
  });

  it('always keeps the best chunk even below the absolute floor', () => {
    const chunks = [chunk('a', 0.7), chunk('b', 0.68)];

    const kept = service.filter(chunks, { relativeMargin: 0, minScore: 0.75 });

    expect(kept.map((c) => c.chunkId)).toEqual(['a']);
  });

  it('applies the stricter of relative margin and absolute floor', () => {
    // best=0.9 → relative cut 0.85, absolute floor 0.88 → floor wins
    const chunks = [chunk('a', 0.9), chunk('b', 0.87), chunk('c', 0.86)];

    const kept = service.filter(chunks, { relativeMargin: 0.05, minScore: 0.88 });

    expect(kept.map((c) => c.chunkId)).toEqual(['a']);
  });

  it('passes chunks without score untouched', () => {
    const chunks = [chunk('a', 0.9), chunk('b'), chunk('c', 0.5)];

    const kept = service.filter(chunks, { relativeMargin: 0.05, minScore: 0 });

    expect(kept.map((c) => c.chunkId)).toEqual(['a', 'b']);
  });

  it('is a no-op when no chunk has a score', () => {
    const chunks = [chunk('a'), chunk('b')];

    const kept = service.filter(chunks, { relativeMargin: 0.05, minScore: 0.9 });

    expect(kept).toEqual(chunks);
  });

  it('is a no-op when both thresholds are disabled', () => {
    const chunks = [chunk('a', 0.9), chunk('b', 0.1)];

    const kept = service.filter(chunks, { relativeMargin: 0, minScore: 0 });

    expect(kept).toEqual(chunks);
  });

  it('handles an empty list', () => {
    expect(service.filter([], { relativeMargin: 0.05, minScore: 0 })).toEqual([]);
  });
});
