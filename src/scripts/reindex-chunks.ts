import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReindexChunksUseCase } from '../modules/ingestion/application/reindex-chunks.usecase';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const useCase = app.get(ReindexChunksUseCase);
  const limit = process.env.REINDEX_LIMIT ? Number(process.env.REINDEX_LIMIT) : undefined;
  const result = await useCase.execute({ limit });
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
