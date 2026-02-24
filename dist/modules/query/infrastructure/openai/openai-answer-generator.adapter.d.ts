import { ConfigService } from '@nestjs/config';
import { AnswerGeneratorPort, GenerateAnswerInput, GenerateAnswerOutput } from '../../domain/ports/answer-generator.port';
import { BrainConfig } from '../../../../config/configuration';
export declare class OpenAiAnswerGeneratorAdapter implements AnswerGeneratorPort {
    private readonly configService;
    private readonly logger;
    private readonly client;
    private readonly model;
    private readonly temperature;
    private readonly maxTokens;
    private readonly timeoutMs;
    constructor(configService: ConfigService<BrainConfig>);
    generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
    private extractCitedSources;
}
