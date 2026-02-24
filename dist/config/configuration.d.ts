export type AppConfig = {
    env: string;
    port: number;
    apiKey: string;
    enableApiKeyAuth: boolean;
    searchEngine: 'mongo' | 'elasticsearch';
    objectStorePath: string;
    topK: number;
    chunkSize: number;
    chunkOverlap: number;
    rateLimitTtl: number;
    rateLimitGlobal: number;
    rateLimitQuery: number;
    rateLimitUpload: number;
    rateLimitIngest: number;
    maxFileSizeMB: number;
    allowedMimeTypes: string[];
};
export type LlmConfig = {
    provider: 'local' | 'openai' | 'anthropic';
    openai: {
        apiKey: string;
        model: string;
        temperature: number;
        maxTokens: number;
        timeoutMs: number;
    };
    anthropic: {
        apiKey: string;
        model: string;
        temperature: number;
        maxTokens: number;
        timeoutMs: number;
    };
};
export type MongoConfig = {
    uri: string;
    dbName: string;
};
export type Neo4jConfig = {
    uri: string;
    user: string;
    password: string;
};
export type RedisConfig = {
    url: string;
};
export type OllamaConfig = {
    baseUrl: string;
    embeddingModel: string;
    extractionModel: string;
    timeoutMs: number;
};
export type BrainConfig = {
    app: AppConfig;
    mongo: MongoConfig;
    neo4j: Neo4jConfig;
    redis: RedisConfig;
    llm: LlmConfig;
    ollama: OllamaConfig;
};
declare const _default: () => BrainConfig;
export default _default;
