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

export type AuthConfig = {
  enableDevLogin: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  successUrl: string;
  failureUrl: string;
  allowedAdminEmails: string[];
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  githubClientId: string;
  githubClientSecret: string;
  githubCallbackUrl: string;
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

export type Neo4jConfig = {
  uri: string;
  user: string;
  password: string;
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
  auth: AuthConfig;
  neo4j: Neo4jConfig;
  llm: LlmConfig;
  ollama: OllamaConfig;
};

const INSECURE_DEFAULTS = {
  apiKey: new Set(['', 'change-me-in-production']),
  jwtSecret: new Set(['change-me-auth-secret']),
  neo4jPassword: new Set(['neo4j_password']),
};

/**
 * Fails fast when running in production with insecure default secrets.
 * Intentionally permissive in non-production environments to keep DX fast.
 */
export function validateProductionConfig(config: BrainConfig): void {
  if (config.app.env !== 'production') {
    return;
  }

  const problems: string[] = [];

  if (config.app.enableApiKeyAuth && INSECURE_DEFAULTS.apiKey.has(config.app.apiKey)) {
    problems.push('API_KEY must be set to a strong value (ENABLE_API_KEY_AUTH=true).');
  }

  if (INSECURE_DEFAULTS.jwtSecret.has(config.auth.jwtSecret)) {
    problems.push('AUTH_JWT_SECRET must be overridden in production.');
  }

  if (INSECURE_DEFAULTS.neo4jPassword.has(config.neo4j.password)) {
    problems.push('NEO4J_PASSWORD must be overridden in production.');
  }

  if (config.auth.cookieSameSite === 'none' && !config.auth.cookieSecure) {
    problems.push('AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=none.');
  }

  if (problems.length > 0) {
    throw new Error(
      `[config] Insecure production configuration:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

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
  auth: {
    enableDevLogin: process.env.AUTH_ENABLE_DEV_LOGIN === 'true',
    jwtSecret: process.env.AUTH_JWT_SECRET ?? 'change-me-auth-secret',
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '8h',
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'pinky_auth',
    cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true',
    cookieSameSite: ((process.env.AUTH_COOKIE_SAME_SITE ?? 'lax').toLowerCase() as 'lax' | 'strict' | 'none'),
    successUrl: process.env.AUTH_SUCCESS_URL ?? 'http://localhost:5173',
    failureUrl: process.env.AUTH_FAILURE_URL ?? 'http://localhost:5173/login?error=unauthorized',
    allowedAdminEmails: (process.env.AUTH_ALLOWED_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:8081/auth/google/callback',
    githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    githubCallbackUrl: process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:8081/auth/github/callback',
  },
  neo4j: {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7688',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'neo4j_password',
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
