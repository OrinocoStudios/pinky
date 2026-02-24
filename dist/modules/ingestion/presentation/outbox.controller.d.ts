import { GraphSyncRetryService } from '../application/graph-sync-retry.service';
import { RetryOutboxDto } from './retry-outbox.dto';
export declare class OutboxController {
    private readonly retryService;
    constructor(retryService: GraphSyncRetryService);
    retry(body: RetryOutboxDto): Promise<{
        processed: number;
        synced: number;
        failed: number;
    }>;
}
