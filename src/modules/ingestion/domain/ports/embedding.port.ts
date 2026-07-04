export type EmbeddingTask = 'document' | 'query';

export interface EmbeddingPort {
  /**
   * Embeds a single text into a vector representation.
   * @param text - Text to embed
   * @param task - Whether the text is an indexed document or a search query.
   *               Defaults to 'document'. Models like nomic-embed produce
   *               asymmetric embeddings and need this distinction.
   * @returns Normalized embedding vector (dimensions depend on model)
   */
  embed(text: string, task?: EmbeddingTask): Promise<number[]>;

  /**
   * Returns the model identifier used for embeddings (for metadata/versioning).
   */
  getModelId(): string;
}
