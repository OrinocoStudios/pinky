export type AppConfig = {
  env: string;
  port: number;
  /** Optional instance ID for outbox claim (e.g. Kubernetes pod name) */
  instanceId?: string;
  apiKey: string;
  enableApiKeyAuth: boolean;
  enableMultiTenant: boolean;
  /**
   * CORS policy for browser consumers.
   * Disabled by default for safer server-to-server integration.
   */
  corsEnabled: boolean;
  /**
   * Comma-separated allowlist origins (e.g. "https://app.example.com,http://localhost:3000").
   * If empty and CORS is enabled, the server will echo/allow origins dynamically.
   */
  corsOrigins: string[];
  searchEngine: 'mongo' | 'elasticsearch' | 'neo4j';
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
  enableChecksumValidation: boolean;
  debugLlm: boolean;
};

export type LlmConfig = {
  provider: 'local' | 'openai' | 'anthropic' | 'ollama';
  openai: {
    baseUrl?: string;
    apiKey: string;
    model: string;
    embeddingModel: string;
    extractionModel: string;
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
  aiModel: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
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

export default (): BrainConfig => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 8081),
    instanceId: process.env.APP_INSTANCE_ID,
    apiKey: process.env.API_KEY ?? '',
    enableApiKeyAuth: process.env.ENABLE_API_KEY_AUTH === 'true',
    enableMultiTenant: process.env.ENABLE_MULTI_TENANT === 'true',
    corsEnabled: process.env.CORS_ENABLED === 'true',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    searchEngine: (process.env.SEARCH_ENGINE ?? 'mongo') as 'mongo' | 'elasticsearch' | 'neo4j',
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
    debugLlm: process.env.ENABLE_LLM_DEBUG === 'true',
  },
  mongo: {
    uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27021/brain_service',
    dbName: process.env.MONGODB_DB ?? 'brain_service',
  },
  neo4j: {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7688',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'neo4j_password',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6381',
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
    extractionModel: process.env.OLLAMA_EXTRACTION_MODEL ?? 'llama3.2',
    aiModel: process.env.OLLAMA_AI_MODEL ?? 'llama3.2',
    apiKey: process.env.OLLAMA_API_KEY,
    temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.2),
    maxTokens: Number(process.env.OLLAMA_MAX_TOKENS ?? 1000),
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000),
  },
  llm: {
    provider: (process.env.LLM_PROVIDER ?? 'local') as 'local' | 'openai' | 'anthropic' | 'ollama',
    openai: {
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'nomic-embed-text',
      extractionModel: process.env.OPENAI_EXTRACTION_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.2),
      maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 4096),
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 120000),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
      temperature: Number(process.env.ANTHROPIC_TEMPERATURE ?? 0.2),
      maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 4096),
      timeoutMs: Number(process.env.ANTHROPIC_TIMEOUT_MS ?? 120000),
    },
  },
});
