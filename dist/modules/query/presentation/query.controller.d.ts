import { GraphRagQueryUseCase } from '../application/graph-rag-query.usecase';
import { QueryDto, QueryResponseDto } from './query.dto';
export declare class QueryController {
    private readonly graphRagQueryUseCase;
    private readonly logger;
    constructor(graphRagQueryUseCase: GraphRagQueryUseCase);
    query(body: QueryDto): Promise<QueryResponseDto>;
}
