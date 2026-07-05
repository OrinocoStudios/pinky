import { PromptBudgetService } from './prompt-budget.service';

type Chunk = { chunkId: string; text: string; score?: number };
type Fact = { fromEntityId: string; type: string; toEntityId: string };

describe('PromptBudgetService', () => {
  const service = new PromptBudgetService();

  const chunk = (chunkId: string, text: string, score?: number): Chunk => ({ chunkId, text, score });
  const fact = (from: string, to: string): Fact => ({ fromEntityId: from, type: 'REL', toEntityId: to });

  describe('computeBudget', () => {
    it('subtracts answer tokens and margin from the context window', () => {
      expect(service.computeBudget(8192, 2560, 512)).toBe(5120);
    });

    it('never returns a negative budget', () => {
      expect(service.computeBudget(100, 200, 50)).toBe(0);
    });
  });

  describe('estimateTokens', () => {
    it('estimates conservatively at 3.5 chars per token', () => {
      expect(service.estimateTokens('x'.repeat(35))).toBe(10);
    });
  });

  describe('fit', () => {
    const baseText = 'B'.repeat(35); // 10 tokens

    it('keeps everything when the budget is ample', () => {
      const chunks = [chunk('c1', 'A'.repeat(100), 0.9), chunk('c2', 'B'.repeat(100), 0.8)];
      const facts = [fact('e1', 'e2')];

      const fitted = service.fit({ chunks, facts, baseText, budgetTokens: 10_000 });

      expect(fitted.chunks).toEqual(chunks);
      expect(fitted.facts).toEqual(facts);
    });

    it('drops excess graph facts before touching chunks', () => {
      const chunks = [chunk('c1', 'A'.repeat(100), 0.9), chunk('c2', 'B'.repeat(100), 0.8)];
      const facts = [fact('e1', 'e2'), fact('e3', 'e4')];
      const budgetTokens =
        service.estimateTokens(baseText) +
        service.chunkCost(chunks[0]) +
        service.chunkCost(chunks[1]) +
        service.factCost(facts[0]);

      const fitted = service.fit({ chunks, facts, baseText, budgetTokens });

      expect(fitted.chunks).toHaveLength(2);
      expect(fitted.facts).toEqual([facts[0]]);
    });

    it('drops worst-score chunks when the budget only fits the best one', () => {
      const chunks = [chunk('c1', 'A'.repeat(100), 0.9), chunk('c2', 'B'.repeat(100), 0.8)];
      const budgetTokens = service.estimateTokens(baseText) + service.chunkCost(chunks[0]);

      const fitted = service.fit({ chunks, facts: [], baseText, budgetTokens });

      expect(fitted.chunks.map((c) => c.chunkId)).toEqual(['c1']);
    });

    it('fills by score even when retrieval order differs', () => {
      const chunks = [chunk('c1', 'A'.repeat(100), 0.8), chunk('c2', 'B'.repeat(100), 0.9)];
      const budgetTokens = service.estimateTokens(baseText) + service.chunkCost(chunks[1]);

      const fitted = service.fit({ chunks, facts: [], baseText, budgetTokens });

      expect(fitted.chunks.map((c) => c.chunkId)).toEqual(['c2']);
    });

    it('always keeps the best chunk, truncated to fit a tiny budget', () => {
      const huge = chunk('c1', 'X'.repeat(10_000), 0.9);

      const fitted = service.fit({ chunks: [huge], facts: [], baseText, budgetTokens: 100 });

      expect(fitted.chunks).toHaveLength(1);
      expect(fitted.chunks[0].text.length).toBeGreaterThan(0);
      expect(fitted.chunks[0].text.length).toBeLessThan(huge.text.length);
    });
  });
});
