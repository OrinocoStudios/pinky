export declare class QueryDto {
    query: string;
    entityHints?: string[];
    topK?: number;
}
export declare class ChunkSourceDto {
    id: string;
    text: string;
}
export declare class GraphFactDto {
    id: string;
    from: string;
    relation: string;
    to: string;
}
export declare class QueryResponseDto {
    answer: string;
    sourcesUsed: string[];
    fastContext: ChunkSourceDto[];
    truthFacts: GraphFactDto[];
    model?: string;
    tokensUsed?: number;
    prompt: string;
}
