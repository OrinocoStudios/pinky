import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingPort } from '../../domain/ports/embedding.port';
import { BrainConfig } from '../../../../config/configuration';
import { createOpenAiClient } from '../../../../common/utils/openai-client';

@Injectable()
export class OpenAiEmbeddingAdapter implements EmbeddingPort {
  private readonly logger = new Logger(OpenAiEmbeddingAdapter.name);
  private readonly client: ReturnType<typeof createOpenAiClient>;
  private readonly model: string;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const openaiConfig = this.configService.get('llm.openai', { infer: true })!;
    this.client = createOpenAiClient(openaiConfig);
    this.model =
      this.configService.get('llm.openai.embeddingModel', {
        infer: true,
      }) ?? 'nomic-embed-text';
  }

  async embed(text: string): Promise<number[]> {
    if (!this.client) {
      throw new Error(
        'OPENAI_API_KEY is required for OpenAI-compatible embeddings unless OPENAI_BASE_URL points to a compatible gateway',
      );
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });
      const vector = response.data[0]?.embedding;

      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('OpenAI-compatible endpoint returned empty embedding');
      }

      return this.normalize(vector);
    } catch (error) {
      this.logger.warn(
        `Falling back to mock embedding due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return new Array(768).fill(0).map(() => Math.random());
    }
  }

  getModelId(): string {
    return this.model;
  }

  private normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((acc, value) => acc + value * value, 0));
    if (!Number.isFinite(norm) || norm <= 0) {
      this.logger.warn('OpenAI-compatible endpoint returned a zero-norm embedding; using safe fallback vector');
      return vec.map((_, index) => (index === 0 ? 1 : 0));
    }

    return vec.map((value) => value / norm);
  }
}
