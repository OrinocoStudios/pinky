import { DocumentRecord, DocumentSource } from './contracts';

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recibido',
  STORED: 'Guardado',
  TEXT_EXTRACTED: 'Texto extraido',
  CHUNKED: 'Preparando contenido',
  EMBEDDED: 'Indexando conocimiento',
  GRAPH_EXTRACTED: 'Analizando conceptos',
  READY: 'Listo para consultar',
  ERROR: 'Requiere atencion',
};

const GRAPH_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de actualizar',
  SYNCED: 'Conocimiento actualizado',
  FAILED: 'No se pudo actualizar',
};

export function formatDocumentStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatGraphSyncLabel(graphSyncStatus: string): string {
  return GRAPH_LABELS[graphSyncStatus] ?? graphSyncStatus;
}

export function getPreviewText(document: DocumentRecord): string {
  const summarized = document.previewText?.trim();
  if (summarized) {
    return summarized;
  }

  const text = document.rawText?.trim();
  if (!text) {
    return 'Este documento aun no tiene contenido de texto disponible.';
  }

  return text.replace(/\s+/g, ' ').slice(0, 240);
}

export function formatSourceLabel(source?: DocumentSource): string {
  if (!source) {
    return 'Origen no disponible';
  }

  if (source.kind === 'upload') {
    return source.filename ? `Archivo: ${source.filename}` : 'Archivo subido';
  }

  if (source.kind === 'url') {
    return `URL: ${source.url}`;
  }

  return `Plantilla: ${source.useCaseId}`;
}
