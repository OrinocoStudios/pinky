import { Injectable } from '@nestjs/common';

export type ChunkScoreFilterOptions = {
  /** Drop chunks scoring more than this below the best chunk. 0 disables. */
  relativeMargin: number;
  /** Absolute score floor. 0 disables. */
  minScore: number;
};

/**
 * Filters low-relevance chunks so noisy citations never reach the answer.
 * Hybrid criterion: keep when score >= max(bestScore - relativeMargin, minScore).
 * The best chunk always survives; chunks without score pass untouched.
 */
@Injectable()
export class ChunkScoreFilterService {
  filter<T extends { score?: number }>(chunks: T[], options: ChunkScoreFilterOptions): T[] {
    const scores = chunks
      .map((chunk) => chunk.score)
      .filter((score): score is number => Number.isFinite(score));
    if (scores.length === 0) {
      return chunks;
    }

    const bestScore = Math.max(...scores);
    const relativeCut = options.relativeMargin > 0 ? bestScore - options.relativeMargin : -Infinity;
    const absoluteCut = options.minScore > 0 ? options.minScore : -Infinity;
    const cut = Math.max(relativeCut, absoluteCut);
    if (cut === -Infinity) {
      return chunks;
    }

    return chunks.filter(
      (chunk) => chunk.score === undefined || chunk.score === bestScore || chunk.score >= cut,
    );
  }
}
