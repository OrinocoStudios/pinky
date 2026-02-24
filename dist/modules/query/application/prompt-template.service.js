"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplateService = void 0;
const common_1 = require("@nestjs/common");
let PromptTemplateService = class PromptTemplateService {
    buildGroundedPrompt(input) {
        const sources = [];
        const contextLines = input.contextSources.map((ctx, index) => {
            const sourceId = `CTX-${index + 1}`;
            sources.push({
                id: sourceId,
                text: ctx.text,
                type: 'chunk',
            });
            return `[${sourceId}]: ${ctx.text}`;
        });
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
    formatPrompt(query, contextLines, factsLines) {
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
};
exports.PromptTemplateService = PromptTemplateService;
exports.PromptTemplateService = PromptTemplateService = __decorate([
    (0, common_1.Injectable)()
], PromptTemplateService);
//# sourceMappingURL=prompt-template.service.js.map