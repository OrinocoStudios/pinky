import { Injectable } from '@nestjs/common';
import { AnswerSource } from '../domain/ports/answer-generator.port';

export type PromptTemplateInput = {
  query: string;
  contextSources: Array<{ id: string; text: string }>;
  graphFacts: Array<{
    id: string;
    fromEntityId: string;
    type: string;
    toEntityId: string;
    confidence: number;
  }>;
};

@Injectable()
export class PromptTemplateService {
  /**
   * Builds a grounded prompt with source IDs for citation traceability
   */
  buildGroundedPrompt(input: PromptTemplateInput): { prompt: string; sources: AnswerSource[] } {
    const sources: AnswerSource[] = [];

    // Build context block with source IDs
    const contextLines = input.contextSources.map((ctx, index) => {
      const sourceId = `CTX-${index + 1}`;
      sources.push({
        id: sourceId,
        text: ctx.text,
        type: 'chunk',
      });
      return `[${sourceId}]: ${ctx.text}`;
    });

    // Build facts block with source IDs
    const factsLines = input.graphFacts.map((fact, index) => {
      const sourceId = `FACT-${index + 1}`;
      sources.push({
        id: sourceId,
        text: `${fact.fromEntityId} -(${fact.type})-> ${fact.toEntityId}`,
        type: 'graph_fact',
      });
      return `[${sourceId}]: ${fact.fromEntityId} -(${fact.type}, confianza=${fact.confidence.toFixed(2)})-> ${fact.toEntityId}`;
    });

    const prompt = this.formatPrompt(input.query, contextLines, factsLines);

    return { prompt, sources };
  }

  private formatPrompt(query: string, contextLines: string[], factsLines: string[]): string {
    return `Eres un asistente clínico experto. Usa la siguiente información para responder la pregunta del usuario en español de forma DIRECTA y PROFESIONAL.

INSTRUCCIONES:
- No incluyas procesos de pensamiento internos o "Thinking Process".
- Responde directamente usando el contexto proporcionado.
- Mantén un tono médico y conciso.

CONTEXTO:
${contextLines.join('\n')}
${factsLines.length > 0 ? factsLines.join('\n') : ''}

PREGUNTA: ${query}

RESPUESTA PROFESIONAL:`;
  }
}
