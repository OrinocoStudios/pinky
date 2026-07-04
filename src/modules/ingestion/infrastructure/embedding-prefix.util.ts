import { EmbeddingTask } from '../domain/ports/embedding.port';

// nomic-embed models require task prefixes; without them retrieval quality collapses.
// https://docs.nomic.ai/reference/endpoints/nomic-embed-text
const NOMIC_TASK_PREFIXES: Record<EmbeddingTask, string> = {
  document: 'search_document: ',
  query: 'search_query: ',
};

export function applyTaskPrefix(model: string, text: string, task: EmbeddingTask): string {
  if (!model.toLowerCase().includes('nomic')) {
    return text;
  }
  return NOMIC_TASK_PREFIXES[task] + text;
}
