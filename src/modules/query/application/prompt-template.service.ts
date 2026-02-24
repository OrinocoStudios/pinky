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
    const template = `Eres un asistente experto que responde preguntas basándote ÚNICAMENTE en el contexto y hechos proporcionados a continuación.

REGLAS ESTRICTAS:
1. Solo usa información del contexto [CTX-X] y hechos [FACT-X] proporcionados
2. Si no tienes información suficiente para responder, di: "No tengo información suficiente para responder esta pregunta"
3. DEBES citar las fuentes usando el formato [CTX-X] o [FACT-X] al final de cada afirmación que hagas
4. NO inventes información ni hagas suposiciones
5. NO uses conocimiento externo, solo lo que se proporciona aquí

PREGUNTA DEL USUARIO:
${query}

CONTEXTO TEXTUAL DISPONIBLE:
${contextLines.length > 0 ? contextLines.join('\n') : 'Sin contexto textual disponible.'}

HECHOS VERIFICADOS DEL GRAFO:
${factsLines.length > 0 ? factsLines.join('\n') : 'Sin hechos de grafo disponibles.'}

INSTRUCCIONES PARA TU RESPUESTA:
- Responde de forma concisa y clara
- Cita cada fuente relevante usando [CTX-X] o [FACT-X]
- Si combinas información de múltiples fuentes, cita todas: [CTX-1][FACT-2]
- Si la información es insuficiente, sé honesto y dilo

RESPUESTA:`;

    return template;
  }
}
