export interface DocumentGeneratorPort {
  /**
   * Generates document content for a given use case.
   * @param useCaseId - Identifier of the use case (e.g. template name, scenario)
   * @param params - Optional parameters for generation (e.g. template variables)
   * @returns Generated text content
   */
  generate(useCaseId: string, params?: Record<string, unknown>): Promise<string>;
}
