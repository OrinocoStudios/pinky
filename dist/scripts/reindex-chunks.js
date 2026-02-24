"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const reindex_chunks_usecase_1 = require("../modules/ingestion/application/reindex-chunks.usecase");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const useCase = app.get(reindex_chunks_usecase_1.ReindexChunksUseCase);
    const limit = process.env.REINDEX_LIMIT ? Number(process.env.REINDEX_LIMIT) : undefined;
    const result = await useCase.execute({ limit });
    console.log(JSON.stringify(result, null, 2));
    await app.close();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=reindex-chunks.js.map