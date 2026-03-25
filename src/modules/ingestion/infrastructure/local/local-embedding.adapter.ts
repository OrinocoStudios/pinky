import { Injectable } from '@nestjs/common';
import { EmbeddingPort } from '../../domain/ports/embedding.port';

@Injectable()
export class LocalEmbeddingAdapter implements EmbeddingPort {
  async embed(text: string): Promise<number[]> {
    // Return a dummy 384-dimension vector (common for small models)
    const vector = new Array(384).fill(0).map(() => Math.random());
    return this.normalize(vector);
  }

  getModelId(): string {
    return 'local-mock-embedding';
  }

  private normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
