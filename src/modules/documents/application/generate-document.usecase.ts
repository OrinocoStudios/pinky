import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_GENERATOR_PORT } from '../../../shared/di.tokens';
import { DocumentGeneratorPort } from '../domain/ports/document-generator.port';
import { DocumentRecord } from '../domain/models/document.model';
import { IngestDocumentUseCase } from '../../ingestion/application/ingest-document.usecase';

export type GenerateDocumentInput = {
  useCaseId: string;
  title?: string;
  params?: Record<string, unknown>;
};

@Injectable()
export class GenerateDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_GENERATOR_PORT)
    private readonly documentGenerator: DocumentGeneratorPort,
    private readonly ingestDocumentUseCase: IngestDocumentUseCase,
  ) {}

  async execute(input: GenerateDocumentInput): Promise<DocumentRecord> {
    const rawText = await this.documentGenerator.generate(input.useCaseId, input.params);
    return this.ingestDocumentUseCase.execute({
      title: input.title ?? `Generated: ${input.useCaseId}`,
      rawText,
      source: { kind: 'generated', useCaseId: input.useCaseId },
      metadata: { params: input.params },
    });
  }
}
