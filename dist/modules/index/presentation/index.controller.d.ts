import { ReindexChunksUseCase } from '../../ingestion/application/reindex-chunks.usecase';
import { ReindexDto } from './index.dto';
export declare class IndexController {
    private readonly reindexChunksUseCase;
    constructor(reindexChunksUseCase: ReindexChunksUseCase);
    rebuild(body: ReindexDto): Promise<import("../../ingestion/application/reindex-chunks.usecase").ReindexChunksOutput>;
    incremental(body: ReindexDto): Promise<import("../../ingestion/application/reindex-chunks.usecase").ReindexChunksOutput>;
}
