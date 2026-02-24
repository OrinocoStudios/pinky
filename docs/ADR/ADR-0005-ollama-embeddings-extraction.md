# ADR-0005: Ollama para embeddings y extracción estructurada de grafo

- **Estado**: Accepted
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

La Fase 1 del plan de ejecución exige reemplazar los componentes temporales (embeddings determinísticos y extractor naive de entidades/relaciones) por adaptadores productivos para mejorar la precisión de recuperación y grounding.

## Decisión

1. **Embeddings**: Implementar `EmbeddingPort` con adaptador Ollama (`OllamaEmbeddingAdapter`) que consume el endpoint `/api/embed` de Ollama. Modelo por defecto: `nomic-embed-text`.
2. **Extracción de grafo**: Implementar `GraphExtractorPort` con adaptador Ollama (`OllamaGraphExtractorAdapter`) que usa el endpoint `/api/generate` con `format: json` para extraer entidades y relaciones por chunk. Modelo por defecto: `llama3.2`.
3. **Versionado**: Persistir `embedding_model` y `extraction_model` en metadata de documento y en cada chunk (`embeddingModel`).
4. **Trazabilidad**: Las relaciones extraídas incluyen `sourceChunkId` real (chunk donde se detectó la relación), no `document-level`.
5. **Reindexación**: Caso de uso `ReindexChunksUseCase` y script `npm run reindex` para recalcular embeddings de chunks existentes.

## Consecuencias

### Positivas

- Búsqueda semántica real en `POST /query`.
- Relaciones del grafo con trazabilidad por chunk.
- Despliegue local sin dependencias de APIs externas (Ollama self-hosted).
- Metadata de modelos permite auditoría y migración futura.

### Negativas

- Requiere Ollama en ejecución local o accesible.
- Latencia de ingesta aumenta por llamadas a Ollama (embedding + extracción por chunk).
- Modelos por defecto pueden no ser óptimos para todos los dominios.

## Alternativas consideradas

1. **OpenAI/Anthropic**: Mayor calidad pero dependencia de APIs externas y coste.
2. **Embeddings determinísticos**: Mantener para desarrollo; descartado por plan explícito de Fase 1.
3. **Extracción a nivel documento**: Menor coste pero peor trazabilidad en `sourceChunkId`; descartado.

## Referencias

- [EXECUTION_PLAN.md](../EXECUTION_PLAN.md) - Fase 1
- [Ollama API - Embed](https://github.com/ollama/ollama/blob/main/docs/api.md)
