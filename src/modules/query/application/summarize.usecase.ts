import { Inject, Injectable } from '@nestjs/common';
import { ANSWER_GENERATOR_PORT } from '../../../shared/di.tokens';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';

export type SummarizeMessage = {
  role: string;
  content: string;
};

export type SummarizeInput = {
  messages: SummarizeMessage[];
  sessionId?: string;
  tenantId?: string;
  libraryId?: string;
};

@Injectable()
export class SummarizeUseCase {
  constructor(
    @Inject(ANSWER_GENERATOR_PORT)
    private readonly answerGenerator: AnswerGeneratorPort,
    private readonly ingestDocumentUseCase: IngestDocumentUseCase,
    private readonly logger: StructuredLogger,
  ) {}

  async execute(input: SummarizeInput): Promise<string> {
    if (input.messages.length === 0) {
      return '';
    }

    const chatHistory = input.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `Eres un asistente clínico experto. Tu única tarea es generar un RESUMEN CLÍNICO directo y profesional de la conversación proporcionada.
PROHIBIDO incluir descripciones de tu análisis, procesos de pensamiento, monólogos internos o encabezados de "Análisis". 
Escribe únicamente el resumen clínico ejecutivo.

CONVERSACIÓN:
${chatHistory}

RESUMEN CLÍNICO EJECUTIVO:`;

    this.logger.debug('Generating summary for chat history', SummarizeUseCase.name, {
      messageCount: input.messages.length,
      sessionId: input.sessionId,
    });

    const result = await this.answerGenerator.generate({
      prompt,
      sources: [],
      maxTokens: 500,
    });

    const summary = result.answer.trim();

    if (summary && input.libraryId) {
      const now = new Date();
      const dateString = now.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      this.logger.log(`Ingesting session summary for library ${input.libraryId}`, SummarizeUseCase.name);
      
      try {
        await this.ingestDocumentUseCase.execute({
          tenantId: input.tenantId,
          libraryId: input.libraryId,
          title: `Resumen de Sesión - ${dateString}`,
          rawText: summary,
          source: {
            kind: 'generated',
            useCaseId: 'SummarizeUseCase'
          },
          metadata: {
            document_type: 'summary',
            sessionId: input.sessionId,
            generatedAt: now.toISOString(),
          },
        });
      } catch (error) {
        this.logger.error(`Failed to ingest session summary: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return summary;
  }
}
