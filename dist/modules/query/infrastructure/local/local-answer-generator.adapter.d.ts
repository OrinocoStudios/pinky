import { AnswerGeneratorPort, GenerateAnswerInput, GenerateAnswerOutput } from '../../domain/ports/answer-generator.port';
export declare class LocalAnswerGeneratorAdapter implements AnswerGeneratorPort {
    generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
}
