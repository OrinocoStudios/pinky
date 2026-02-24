import { Injectable } from '@nestjs/common';
import { DocumentGeneratorPort } from '../../domain/ports/document-generator.port';

@Injectable()
export class TemplateDocumentGeneratorAdapter implements DocumentGeneratorPort {
  private readonly templates: Map<string, (params: Record<string, unknown>) => string> = new Map([
    ['sample', (p) => `Documento de ejemplo generado.\nParámetros: ${JSON.stringify(p ?? {})}`],
    ['manual-api-text', () => 'Documento creado vía API manual.'],
    ['placeholder', (p) => `Placeholder para caso de uso.\nTítulo: ${String((p as { title?: string })?.title ?? 'Sin título')}`],
  ]);

  async generate(useCaseId: string, params?: Record<string, unknown>): Promise<string> {
    const template = this.templates.get(useCaseId);
    if (template) {
      return template(params ?? {});
    }
    return `Documento generado para caso de uso "${useCaseId}".\nParámetros: ${JSON.stringify(params ?? {})}`;
  }
}
