import { ChunkSearchPort } from '../../search/domain/ports/chunk-search.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { PromptTemplateService } from './prompt-template.service';
export type GraphRagQueryInput = {
    query: string;
    entityHints?: string[];
    topK: number;
};
export type GraphRagQueryOutput = {
    prompt: string;
    answer: string;
    sourcesUsed: string[];
    fastContext: Array<{
        id: string;
        text: string;
    }>;
    truthFacts: Array<{
        id: string;
        from: string;
        relation: string;
        to: string;
    }>;
    model?: string;
    tokensUsed?: number;
};
export declare class GraphRagQueryUseCase {
    private readonly chunkSearch;
    private readonly graphStore;
    private readonly answerGenerator;
    private readonly promptTemplate;
    private readonly logger;
    constructor(chunkSearch: ChunkSearchPort, graphStore: GraphStorePort, answerGenerator: AnswerGeneratorPort, promptTemplate: PromptTemplateService);
    execute(input: GraphRagQueryInput): Promise<GraphRagQueryOutput>;
    private extractEntityHintsFromQuery;
}
