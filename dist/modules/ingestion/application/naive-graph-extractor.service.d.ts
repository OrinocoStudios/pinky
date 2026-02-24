import { ExtractedGraph } from '../../graph/domain/models/graph.model';
export declare class NaiveGraphExtractorService {
    extract(documentId: string, text: string): ExtractedGraph;
}
