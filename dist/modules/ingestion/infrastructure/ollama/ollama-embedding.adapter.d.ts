import { ConfigService } from '@nestjs/config';
import { EmbeddingPort } from '../../domain/ports/embedding.port';
import { BrainConfig } from '../../../../config/configuration';
export declare class OllamaEmbeddingAdapter implements EmbeddingPort {
    private readonly configService;
    private readonly baseUrl;
    private readonly model;
    private readonly timeoutMs;
    constructor(configService: ConfigService<BrainConfig>);
    embed(text: string): Promise<number[]>;
    getModelId(): string;
    private normalize;
}
