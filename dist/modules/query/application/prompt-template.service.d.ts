import { AnswerSource } from '../domain/ports/answer-generator.port';
export type PromptTemplateInput = {
    query: string;
    contextSources: Array<{
        id: string;
        text: string;
    }>;
    graphFacts: Array<{
        id: string;
        fromEntityId: string;
        type: string;
        toEntityId: string;
        confidence: number;
    }>;
};
export declare class PromptTemplateService {
    buildGroundedPrompt(input: PromptTemplateInput): {
        prompt: string;
        sources: AnswerSource[];
    };
    private formatPrompt;
}
