export type AnswerSource = {
  id: string;
  text: string;
  type: 'chunk' | 'graph_fact';
};

export type GenerateAnswerInput = {
  prompt: string;
  sources: AnswerSource[];
  maxTokens?: number;
};

export type GenerateAnswerOutput = {
  answer: string;
  sourcesUsed: string[];
  model?: string;
  tokensUsed?: number;
};

export interface AnswerGeneratorPort {
  generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
}
