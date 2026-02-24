"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IngestDocumentUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestDocumentUseCase = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nestjs_prometheus_1 = require("@willsoto/nestjs-prometheus");
const prom_client_1 = require("prom-client");
const node_crypto_1 = require("node:crypto");
const di_tokens_1 = require("../../../shared/di.tokens");
const simple_chunker_service_1 = require("./simple-chunker.service");
const checksum_service_1 = require("../../../common/utils/checksum.service");
let IngestDocumentUseCase = IngestDocumentUseCase_1 = class IngestDocumentUseCase {
    documentRepository;
    graphStore;
    embeddingPort;
    graphExtractor;
    chunker;
    checksumService;
    configService;
    documentsIngestedCounter;
    logger = new common_1.Logger(IngestDocumentUseCase_1.name);
    constructor(documentRepository, graphStore, embeddingPort, graphExtractor, chunker, checksumService, configService, documentsIngestedCounter) {
        this.documentRepository = documentRepository;
        this.graphStore = graphStore;
        this.embeddingPort = embeddingPort;
        this.graphExtractor = graphExtractor;
        this.chunker = chunker;
        this.checksumService = checksumService;
        this.configService = configService;
        this.documentsIngestedCounter = documentsIngestedCounter;
    }
    async execute(input) {
        const checksum = this.checksumService.calculate(input.rawText);
        const enableChecksum = this.configService.get('app.enableChecksumValidation', { infer: true });
        if (enableChecksum) {
            const existing = await this.documentRepository.findDocumentByChecksum(checksum);
            if (existing) {
                this.logger.log(`Document already exists (checksum match): ${existing.documentId}`);
                return existing;
            }
        }
        const documentId = (0, node_crypto_1.randomUUID)();
        const embeddingModel = this.embeddingPort.getModelId();
        const extractionModel = this.graphExtractor.getModelId();
        const docMetadata = {
            ...input.metadata,
            embedding_model: embeddingModel,
            extraction_model: extractionModel,
        };
        let created;
        try {
            created = await this.documentRepository.createDocument({
                documentId,
                title: input.title,
                rawText: input.rawText,
                source: input.source,
                status: 'RECEIVED',
                graphSyncStatus: 'PENDING',
                checksum,
                metadata: docMetadata,
            });
        }
        catch (error) {
            if (enableChecksum && this.isDuplicateChecksumError(error)) {
                const existing = await this.documentRepository.findDocumentByChecksum(checksum);
                if (existing) {
                    this.logger.log(`Document already exists after concurrent insert attempt (checksum match): ${existing.documentId}`);
                    return existing;
                }
            }
            throw error;
        }
        try {
            const chunks = this.chunker.chunk(documentId, input.rawText);
            const chunksWithEmbeddings = await Promise.all(chunks.map(async (chunk) => ({
                ...chunk,
                embedding: await this.embeddingPort.embed(chunk.text),
                embeddingModel,
            })));
            await this.documentRepository.addChunks(chunksWithEmbeddings);
            await this.documentRepository.updateDocumentStatus(documentId, 'EMBEDDED', 'PENDING');
            const chunkInputs = chunks.map((c) => ({ chunkId: c.chunkId, text: c.text }));
            const extractedGraph = await this.graphExtractor.extract(documentId, chunkInputs);
            const syncEvent = await this.documentRepository.enqueueGraphSyncEvent(documentId, extractedGraph);
            await this.graphStore.upsertGraph(extractedGraph);
            await this.documentRepository.updateDocumentStatus(documentId, 'READY', 'SYNCED');
            await this.documentRepository.markGraphSyncEvent(syncEvent.eventId, 'SYNCED', {
                attempts: 1,
                lastError: '',
            });
            this.documentsIngestedCounter.inc();
        }
        catch (error) {
            await this.documentRepository.updateDocumentStatus(documentId, 'ERROR', 'FAILED');
            throw new common_1.InternalServerErrorException({
                message: 'Document ingested in NoSQL but graph sync failed',
                documentId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        return (await this.documentRepository.findDocumentById(documentId)) ?? created;
    }
    isDuplicateChecksumError(error) {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybeError = error;
        return maybeError.code === 11000 && maybeError.message?.includes('checksum') === true;
    }
};
exports.IngestDocumentUseCase = IngestDocumentUseCase;
exports.IngestDocumentUseCase = IngestDocumentUseCase = IngestDocumentUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __param(2, (0, common_1.Inject)(di_tokens_1.EMBEDDING_PORT)),
    __param(3, (0, common_1.Inject)(di_tokens_1.GRAPH_EXTRACTOR_PORT)),
    __param(7, (0, nestjs_prometheus_1.InjectMetric)('brain_documents_ingested_total')),
    __metadata("design:paramtypes", [Object, Object, Object, Object, simple_chunker_service_1.SimpleChunkerService,
        checksum_service_1.ChecksumService,
        config_1.ConfigService,
        prom_client_1.Counter])
], IngestDocumentUseCase);
//# sourceMappingURL=ingest-document.usecase.js.map