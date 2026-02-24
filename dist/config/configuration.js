"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    app: {
        env: process.env.NODE_ENV ?? 'development',
        port: Number(process.env.PORT ?? 8081),
        instanceId: process.env.APP_INSTANCE_ID,
        apiKey: process.env.API_KEY ?? '',
        enableApiKeyAuth: process.env.ENABLE_API_KEY_AUTH === 'true',
        searchEngine: (process.env.SEARCH_ENGINE ?? 'mongo'),
        objectStorePath: process.env.OBJECT_STORE_PATH ?? './data/objects',
        topK: Number(process.env.TOP_K ?? 8),
        chunkSize: Number(process.env.CHUNK_SIZE ?? 1200),
        chunkOverlap: Number(process.env.CHUNK_OVERLAP ?? 200),
        rateLimitTtl: Number(process.env.RATE_LIMIT_TTL ?? 60000),
        rateLimitGlobal: Number(process.env.RATE_LIMIT_GLOBAL ?? 10),
        rateLimitQuery: Number(process.env.RATE_LIMIT_QUERY ?? 5),
        rateLimitUpload: Number(process.env.RATE_LIMIT_UPLOAD ?? 3),
        rateLimitIngest: Number(process.env.RATE_LIMIT_INGEST ?? 5),
        maxFileSizeMB: Number(process.env.MAX_FILE_SIZE_MB ?? 10),
        allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES ?? 'text/plain,text/markdown,application/json,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(','),
        enableChecksumValidation: process.env.ENABLE_CHECKSUM_VALIDATION !== 'false',
    },
    mongo: {
        uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27021/brain_service',
        dbName: process.env.MONGODB_DB ?? 'brain_service',
    },
    neo4j: {
        uri: process.env.NEO4J_URI ?? 'bolt://localhost:7688',
        user: process.env.NEO4J_USER ?? 'neo4j',
        password: process.env.NEO4J_PASSWORD ?? '',
    },
    redis: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6381',
    },
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
        extractionModel: process.env.OLLAMA_EXTRACTION_MODEL ?? 'llama3.2',
        timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000),
    },
    llm: {
        provider: (process.env.LLM_PROVIDER ?? 'local'),
        openai: {
            apiKey: process.env.OPENAI_API_KEY ?? '',
            model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.2),
            maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 1000),
            timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
        },
        anthropic: {
            apiKey: process.env.ANTHROPIC_API_KEY ?? '',
            model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
            temperature: Number(process.env.ANTHROPIC_TEMPERATURE ?? 0.2),
            maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 1000),
            timeoutMs: Number(process.env.ANTHROPIC_TIMEOUT_MS ?? 30000),
        },
    },
});
//# sourceMappingURL=configuration.js.map