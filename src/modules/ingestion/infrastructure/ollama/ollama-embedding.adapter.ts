import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingPort } from '../../domain/ports/embedding.port';
import { BrainConfig } from '../../../../config/configuration';

type OllamaEmbedResponse = {
  embeddings: number[][];
};

@Injectable()
export class OllamaEmbeddingAdapter implements EmbeddingPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const ollama = configService.get('ollama', { infer: true });
    this.baseUrl = ollama?.baseUrl ?? 'http://localhost:11434';
    this.model = ollama?.embeddingModel ?? 'nomic-embed-text';
    this.timeoutMs = ollama?.timeoutMs ?? 30000;
  }

  async embed(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Ollama embed failed (${res.status}): ${errBody}`);
      }

      const data = (await res.json()) as OllamaEmbedResponse;
      const vector = data.embeddings?.[0];
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('Ollama returned empty or invalid embedding');
      }

      return this.normalize(vector);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(`Ollama embed timeout after ${this.timeoutMs}ms`);
        }
        throw err;
      }
      throw new Error('Ollama embed failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getModelId(): string {
    return this.model;
  }

  private normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
