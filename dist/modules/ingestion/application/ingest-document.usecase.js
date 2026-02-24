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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestDocumentUseCase = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const di_tokens_1 = require("../../../shared/di.tokens");
const simple_chunker_service_1 = require("./simple-chunker.service");
let IngestDocumentUseCase = class IngestDocumentUseCase {
    documentRepository;
    graphStore;
    embeddingPort;
    graphExtractor;
    chunker;
    constructor(documentRepository, graphStore, embeddingPort, graphExtractor, chunker) {
        this.documentRepository = documentRepository;
        this.graphStore = graphStore;
        this.embeddingPort = embeddingPort;
        this.graphExtractor = graphExtractor;
        this.chunker = chunker;
    }
    async execute(input) {
        const documentId = (0, node_crypto_1.randomUUID)();
        const embeddingModel = this.embeddingPort.getModelId();
        const extractionModel = this.graphExtractor.getModelId();
        const docMetadata = {
            ...input.metadata,
            embedding_model: embeddingModel,
            extraction_model: extractionModel,
        };
        const created = await this.documentRepository.createDocument({
            documentId,
            title: input.title,
            rawText: input.rawText,
            source: input.source,
            status: 'RECEIVED',
            graphSyncStatus: 'PENDING',
            metadata: docMetadata,
        });
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
            await this.documentRepository.markGraphSyncEvent(syncEvent.eventId, 'SYNCED', {
                attempts: 1,
                lastError: '',
            });
            await this.documentRepository.updateDocumentStatus(documentId, 'READY', 'SYNCED');
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
};
exports.IngestDocumentUseCase = IngestDocumentUseCase;
exports.IngestDocumentUseCase = IngestDocumentUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(di_tokens_1.DOCUMENT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(di_tokens_1.GRAPH_STORE_PORT)),
    __param(2, (0, common_1.Inject)(di_tokens_1.EMBEDDING_PORT)),
    __param(3, (0, common_1.Inject)(di_tokens_1.GRAPH_EXTRACTOR_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, simple_chunker_service_1.SimpleChunkerService])
], IngestDocumentUseCase);
//# sourceMappingURL=ingest-document.usecase.js.map