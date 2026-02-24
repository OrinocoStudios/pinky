import { ExtractedGraph } from '../../../graph/domain/models/graph.model';
export type ChunkInput = {
    chunkId: string;
    text: string;
};
export interface GraphExtractorPort {
    extract(documentId: string, chunks: ChunkInput[]): Promise<ExtractedGraph>;
    getModelId(): string;
}
