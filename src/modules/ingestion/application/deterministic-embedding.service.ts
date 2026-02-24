import { Injectable } from '@nestjs/common';

@Injectable()
export class DeterministicEmbeddingService {
  // Placeholder deterministic embedding for initial scaffolding.
  // Replace with a real embedding provider adapter in the next step.
  embed(text: string, dimensions = 64): number[] {
    const vector = new Array<number>(dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      vector[i % dimensions] += (code % 97) / 97;
    }

    const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  }
}
