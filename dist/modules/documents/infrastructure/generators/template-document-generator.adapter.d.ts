import { DocumentGeneratorPort } from '../../domain/ports/document-generator.port';
export declare class TemplateDocumentGeneratorAdapter implements DocumentGeneratorPort {
    private readonly templates;
    generate(useCaseId: string, params?: Record<string, unknown>): Promise<string>;
}
