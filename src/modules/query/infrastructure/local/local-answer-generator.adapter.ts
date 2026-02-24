import { Injectable } from '@nestjs/common';
import {
  AnswerGeneratorPort,
  GenerateAnswerInput,
  GenerateAnswerOutput,
} from '../../domain/ports/answer-generator.port';

@Injectable()
export class LocalAnswerGeneratorAdapter implements AnswerGeneratorPort {
  async generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    // Temporary deterministic answer generator.
    // Replace with OpenAI/Anthropic adapter in next step.
    const max = 1200;
    const trimmed = input.prompt.length > max ? `${input.prompt.slice(0, max)}...` : input.prompt;

    // Extract all source IDs as "used" for local mode
    const sourcesUsed = input.sources.map((s) => s.id);

    return {
      answer: `Respuesta grounded preliminar (modo local):\n\n${trimmed}`,
      sourcesUsed,
      model: 'local-deterministic',
      tokensUsed: 0,
    };
  }
}
