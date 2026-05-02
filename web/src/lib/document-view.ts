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
  const maxLength = 120;
  function truncate(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength).trimEnd()}...`;
  }

  const summarized = document.previewText?.trim();
  if (summarized) {
    return truncate(summarized);
  }

  const text = document.rawText?.trim();
  if (!text) {
    return 'Este documento aun no tiene contenido de texto disponible.';
  }

  return truncate(text);
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
