import { Counter, Histogram } from 'prom-client';
import { ChunkSearchPort } from '../../search/domain/ports/chunk-search.port';
import { GraphStorePort } from '../../graph/domain/ports/graph-store.port';
import { AnswerGeneratorPort } from '../domain/ports/answer-generator.port';
import { PromptTemplateService } from './prompt-template.service';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';
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
    private readonly queriesTotalCounter;
    private readonly queryErrorsCounter;
    private readonly queryLatencyHistogram;
    constructor(chunkSearch: ChunkSearchPort, graphStore: GraphStorePort, answerGenerator: AnswerGeneratorPort, promptTemplate: PromptTemplateService, logger: StructuredLogger, queriesTotalCounter: Counter<string>, queryErrorsCounter: Counter<string>, queryLatencyHistogram: Histogram<string>);
    execute(input: GraphRagQueryInput): Promise<GraphRagQueryOutput>;
    private extractEntityHintsFromQuery;
}
