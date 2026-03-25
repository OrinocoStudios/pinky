import { Inject, Injectable } from '@nestjs/common';
import { ANSWER_GENERATOR_PORT } from '../../../shared/di.tokens';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

export type SummarizeMessage = {
  role: string;
  content: string;
};

export type SummarizeInput = {
  messages: SummarizeMessage[];
};

@Injectable()
export class SummarizeUseCase {
  constructor(
    @Inject(ANSWER_GENERATOR_PORT)
    private readonly answerGenerator: AnswerGeneratorPort,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: SummarizeInput): Promise<string> {
    if (input.messages.length === 0) {
      return '';
    }

    const chatHistory = input.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `A continuación se presenta una conversación entre un médico y un asistente de IA. 
Por favor, genera un resumen clínico conciso y ejecutivo de los puntos clave discutidos, hallazgos mencionados y recomendaciones dadas.

CONVERSACIÓN:
${chatHistory}

RESUMEN CLÍNICO:`;

    this.logger.debug('Generating summary for chat history', SummarizeUseCase.name, {
      messageCount: input.messages.length,
    });

    const result = await this.answerGenerator.generate({
      prompt,
      sources: [],
      maxTokens: 500,
    });

    return result.answer.trim();
  }
}
