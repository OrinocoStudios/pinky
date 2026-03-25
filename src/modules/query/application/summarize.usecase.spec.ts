import { Test, TestingModule } from '@nestjs/testing';
import { SummarizeUseCase } from './summarize.usecase';
import { ANSWER_GENERATOR_PORT } from '../../../shared/di.tokens';
import { StructuredLogger } from '../../../common/logger/structured-logger.service';

describe('SummarizeUseCase', () => {
  let useCase: SummarizeUseCase;
  let answerGeneratorMock: { generate: jest.Mock };

  beforeEach(async () => {
    answerGeneratorMock = {
      generate: jest.fn().mockResolvedValue({
        answer: 'This is a summary of the clinical conversation.',
        sourcesUsed: [],
        model: 'test-model',
        tokensUsed: 100,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummarizeUseCase,
        {
          provide: ANSWER_GENERATOR_PORT,
          useValue: answerGeneratorMock,
        },
        {
          provide: StructuredLogger,
          useValue: {
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<SummarizeUseCase>(SummarizeUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should return an empty string if there are no messages', async () => {
    const result = await useCase.execute({ messages: [] });
    expect(result).toBe('');
    expect(answerGeneratorMock.generate).not.toHaveBeenCalled();
  });

  it('should format messages and call the answer generator', async () => {
    const messages = [
      { role: 'user', content: 'Hello doctor' },
      { role: 'assistant', content: 'Hello patient' },
    ];

    const result = await useCase.execute({ messages });

    expect(result).toBe('This is a summary of the clinical conversation.');
    expect(answerGeneratorMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('USER: Hello doctor'),
        sources: [],
      }),
    );
  });
});
