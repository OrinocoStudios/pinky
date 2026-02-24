export interface EmbeddingPort {
  /**
   * Embeds a single text into a vector representation.
   * @param text - Text to embed
   * @returns Normalized embedding vector (dimensions depend on model)
   */
  embed(text: string): Promise<number[]>;

  /**
   * Returns the model identifier used for embeddings (for metadata/versioning).
   */
  getModelId(): string;
}
