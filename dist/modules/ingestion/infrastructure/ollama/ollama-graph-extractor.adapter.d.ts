import { ConfigService } from '@nestjs/config';
import { GraphExtractorPort, ChunkInput } from '../../domain/ports/graph-extractor.port';
import { ExtractedGraph } from '../../../graph/domain/models/graph.model';
import { BrainConfig } from '../../../../config/configuration';
export declare class OllamaGraphExtractorAdapter implements GraphExtractorPort {
    private readonly configService;
    private readonly baseUrl;
    private readonly model;
    private readonly timeoutMs;
    constructor(configService: ConfigService<BrainConfig>);
    extract(documentId: string, chunks: ChunkInput[]): Promise<ExtractedGraph>;
    getModelId(): string;
    private extractFromChunk;
    private extractJson;
    private makeEntityId;
    private deduplicateEntities;
}
