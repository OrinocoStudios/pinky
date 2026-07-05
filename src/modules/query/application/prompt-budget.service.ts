import { Injectable } from '@nestjs/common';

type BudgetChunk = { text: string; score?: number };
type BudgetFact = { fromEntityId: string; type: string; toEntityId: string };

export type PromptBudgetInput<TChunk extends BudgetChunk, TFact extends BudgetFact> = {
  chunks: TChunk[];
  facts: TFact[];
  /** Prompt skeleton with no context (template + query). */
  baseText: string;
  budgetTokens: number;
};

/** Conservative for Spanish text; the caller's margin covers the estimation error. */
const CHARS_PER_TOKEN = 3.5;
const CHUNK_LINE_PREFIX = '[CTX-00]: ';

/**
 * Keeps the grounded prompt inside the model slot: fills with the best-scored
 * chunks first, then graph facts, dropping whatever does not fit. The best
 * chunk always survives (truncated in the degenerate case).
 */
@Injectable()
export class PromptBudgetService {
  computeBudget(contextWindow: number, answerMaxTokens: number, marginTokens: number): number {
    return Math.max(0, contextWindow - answerMaxTokens - marginTokens);
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  chunkCost(chunk: { text: string }): number {
    return this.estimateTokens(`${CHUNK_LINE_PREFIX}${chunk.text}\n`);
  }

  factCost(fact: BudgetFact): number {
    return this.estimateTokens(
      `[FACT-00]: ${fact.fromEntityId} -(${fact.type}, confianza=0.00)-> ${fact.toEntityId}\n`,
    );
  }

  fit<TChunk extends BudgetChunk, TFact extends BudgetFact>(
    input: PromptBudgetInput<TChunk, TFact>,
  ): { chunks: TChunk[]; facts: TFact[] } {
    let remaining = input.budgetTokens - this.estimateTokens(input.baseText);

    const byScoreDesc = [...input.chunks].sort(
      (a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity),
    );
    const keptChunks: TChunk[] = [];
    for (const chunk of byScoreDesc) {
      const cost = this.chunkCost(chunk);
      if (cost <= remaining) {
        keptChunks.push(chunk);
        remaining -= cost;
      }
    }
    if (keptChunks.length === 0 && byScoreDesc.length > 0) {
      const best = byScoreDesc[0];
      const allowedChars = Math.max(
        1,
        Math.floor(Math.max(remaining, 0) * CHARS_PER_TOKEN) - CHUNK_LINE_PREFIX.length - 1,
      );
      keptChunks.push({ ...best, text: best.text.slice(0, allowedChars) });
      remaining = 0;
    }

    const keptFacts: TFact[] = [];
    for (const fact of input.facts) {
      const cost = this.factCost(fact);
      if (cost <= remaining) {
        keptFacts.push(fact);
        remaining -= cost;
      }
    }

    return { chunks: keptChunks, facts: keptFacts };
  }
}
