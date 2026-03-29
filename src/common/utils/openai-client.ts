import OpenAI from 'openai';
import type { BrainConfig } from '../../config/configuration';

type OpenAiConfig = BrainConfig['llm']['openai'];

export function createOpenAiClient(config: OpenAiConfig): OpenAI | null {
  const baseUrl = config.baseUrl?.trim();
  const apiKey = config.apiKey.trim();

  if (!baseUrl && !apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey: apiKey || 'ollama',
    baseURL: baseUrl || undefined,
    timeout: config.timeoutMs,
    maxRetries: 3,
  });
}
