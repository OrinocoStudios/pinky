import { ConfigService } from '@nestjs/config';
import { BrainConfig } from '../../../config/configuration';
import { DocumentChunk } from '../../documents/domain/models/document.model';
export declare class SimpleChunkerService {
    private readonly configService;
    constructor(configService: ConfigService<BrainConfig>);
    chunk(documentId: string, text: string): DocumentChunk[];
}
