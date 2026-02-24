import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  AnswerGeneratorPort,
  GenerateAnswerInput,
  GenerateAnswerOutput,
} from '../../domain/ports/answer-generator.port';
import { BrainConfig } from '../../../../config/configuration';

@Injectable()
export class AnthropicAnswerGeneratorAdapter implements AnswerGeneratorPort {
  private readonly logger = new Logger(AnthropicAnswerGeneratorAdapter.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const llmConfig = this.configService.get('llm', { infer: true })!;
    const anthropicConfig = llmConfig.anthropic;

    this.client = anthropicConfig.apiKey
      ? new Anthropic({
          apiKey: anthropicConfig.apiKey,
          timeout: anthropicConfig.timeoutMs,
          maxRetries: 3,
        })
      : (null as unknown as Anthropic);

    this.model = anthropicConfig.model;
    this.temperature = anthropicConfig.temperature;
    this.maxTokens = anthropicConfig.maxTokens;
    this.timeoutMs = anthropicConfig.timeoutMs;

    this.logger.log(
      `Initialized Anthropic adapter with model=${this.model}, temperature=${this.temperature}, maxTokens=${this.maxTokens}`,
    );
  }

  async generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    if (!this.client) {
      throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
    }
    const startTime = Date.now();

    try {
      this.logger.debug(`Generating answer with ${input.sources.length} sources`);

      const response = await this.client.messages.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: input.prompt,
          },
        ],
        temperature: this.temperature,
        max_tokens: input.maxTokens ?? this.maxTokens,
      });

      // Extract text from response
      const textBlock = response.content.find((block) => block.type === 'text');
      const answer = textBlock && 'text' in textBlock ? textBlock.text : '';

      // Anthropic returns input_tokens and output_tokens separately
      const tokensUsed =
        (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

      // Extract cited source IDs from answer
      const sourcesUsed = this.extractCitedSources(answer, input.sources.map((s) => s.id));

      const latency = Date.now() - startTime;
      this.logger.log(
        `Generated answer in ${latency}ms, tokens=${tokensUsed}, sources_cited=${sourcesUsed.length}`,
      );

      return {
        answer,
        sourcesUsed,
        model: this.model,
        tokensUsed,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error(`Failed to generate answer after ${latency}ms: ${error}`);

      if (error instanceof Anthropic.APIError) {
        if (error.status === 401) {
          throw new Error('Anthropic authentication failed. Check ANTHROPIC_API_KEY');
        }
        if (error.status === 429) {
          throw new Error('Anthropic rate limit exceeded. Retry later');
        }
        if (error.status === 404) {
          throw new Error(`Anthropic model not found: ${this.model}`);
        }
        throw new Error(`Anthropic API error: ${error.message}`);
      }

      throw new Error(`Unexpected error generating answer: ${error}`);
    }
  }

  /**
   * Extracts cited source IDs from the answer text
   * Looks for patterns like [CTX-1], [FACT-2], etc.
   */
  private extractCitedSources(answer: string, availableSourceIds: string[]): string[] {
    const citationPattern = /\[(CTX-\d+|FACT-\d+)\]/g;
    const matches = answer.matchAll(citationPattern);
    const cited = new Set<string>();

    for (const match of matches) {
      const sourceId = match[1];
      if (availableSourceIds.includes(sourceId)) {
        cited.add(sourceId);
      }
    }

    return Array.from(cited);
  }
}
