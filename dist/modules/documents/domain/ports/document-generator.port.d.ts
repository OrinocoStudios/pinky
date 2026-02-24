export interface DocumentGeneratorPort {
    generate(useCaseId: string, params?: Record<string, unknown>): Promise<string>;
}
