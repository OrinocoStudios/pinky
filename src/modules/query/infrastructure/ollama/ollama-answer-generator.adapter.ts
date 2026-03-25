import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnswerGeneratorPort, GenerateAnswerInput, GenerateAnswerOutput } from '../../domain/ports/answer-generator.port';
import { BrainConfig } from '../../../../config/configuration';

type OllamaChatResponse = {
  model: string;
  message: {
    content: string;
  };
};

@Injectable()
export class OllamaAnswerGeneratorAdapter implements AnswerGeneratorPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly temperature: number;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const ollama = configService.get('ollama', { infer: true });
    this.baseUrl = ollama?.baseUrl ?? 'http://localhost:11434';
    this.model = ollama?.aiModel ?? 'llama3.2';
    this.apiKey = ollama?.apiKey;
    this.timeoutMs = ollama?.timeoutMs ?? 60000;
    this.temperature = ollama?.temperature ?? 0.2;
  }

  async generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s for real AI

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    try {
      const messages = [
        { role: 'user', content: input.prompt },
      ];

      const body = {
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: this.temperature,
          num_predict: input.maxTokens ?? 1000,
        },
      };

      console.log(`[OllamaAdapter] Requesting to ${this.baseUrl}/api/chat with model ${this.model}`);
      console.log(`[OllamaAdapter] Headers: ${JSON.stringify({ ...headers, 'X-API-Key': '***' + (this.apiKey?.slice(-4) ?? '') })}`);

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      console.log(`[OllamaAdapter] Response Status: ${res.status}`);

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[OllamaAdapter] Error ${res.status}: ${errBody}`);
        throw new Error(`Ollama chat failed (${res.status}): ${errBody}`);
      }

      const dataText = await res.text();
      console.log(`[OllamaAdapter] Response Body: ${dataText.slice(0, 100)}...`);
      
      const data = JSON.parse(dataText) as OllamaChatResponse;
      return {
        answer: data.message?.content || 'Error: No content in AI response',
        sourcesUsed: [],
        model: data.model,
      };
    } catch (err) {
      console.error('[OllamaAdapter] FATAL ERROR:', err);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Ollama chat timeout after 120s');
        }
        throw err;
      }
      throw new Error('Ollama chat failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
