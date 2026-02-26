# Análisis del Proyecto "Pinky" (Brain Service) — Integración con IA

## Qué es

API de ingesta documental y consulta GraphRAG construida con NestJS + TypeScript en **arquitectura hexagonal**. En esencia, es un "cerebro" que:

1. **Ingesta documentos** (txt, md, json, csv, pdf, docx) → los fragmenta en chunks → genera embeddings con Ollama (`nomic-embed-text`) → extrae entidades/relaciones con LLM (`llama3.2`) → persiste todo en MongoDB + Neo4j.
2. **Responde consultas** con GraphRAG: búsqueda híbrida en chunks + hechos del grafo → construye prompt grounded con citaciones `[CTX-X]`/`[FACT-X]` → genera respuesta con LLM (local, OpenAI o Anthropic).

## Stack actual

- **MongoDB**: documentos, chunks, embeddings, outbox de sincronización
- **Neo4j**: grafo de conocimiento (entidades + relaciones)
- **Ollama**: embeddings locales + extracción de entidades
- **OpenAI / Anthropic**: generación de respuestas (intercambiables via `LLM_PROVIDER`)
- **Redis**: disponible (rate limiting/cache)
- **Prometheus**: métricas operacionales

## Arquitectura hexagonal (puertos clave)

El diseño con **puertos y adaptadores** es lo que hace a este proyecto especialmente apto para integrar programas de IA. Los puertos actuales son:

- `EmbeddingPort` — Vectorizar texto → Adaptador: Ollama
- `GraphExtractorPort` — Extraer entidades/relaciones → Adaptador: Ollama (llama3.2)
- `AnswerGeneratorPort` — Generar respuesta grounded → Adaptadores: Local, OpenAI, Anthropic
- `ChunkSearchPort` — Buscar chunks relevantes → Adaptadores: Mongo, Elasticsearch
- `DocumentGeneratorPort` — Generar documentos por caso de uso → Adaptador: Templates
- `GraphStorePort` — Persistir/consultar grafo → Adaptador: Neo4j

---

## Cómo puede funcionar con diversos programas automatizados con IA

### 1. Agentes autónomos (LangChain, CrewAI, AutoGen)

Pinky puede actuar como **memoria de largo plazo y base de conocimiento** para agentes. Un agente podría:

- Alimentar Pinky via `POST /documents/text` o `/documents/upload` con información que descubra.
- Consultar via `POST /query` para fundamentar decisiones con hechos citados.
- El agente obtiene respuestas grounded (con fuentes), no alucinaciones.

**Implementación**: Crear un adaptador `AgentMemoryPort` que exponga `store(knowledge)` y `recall(question)` como herramientas (tools) de LangChain/CrewAI.

### 2. Chatbots con RAG (Dialogflow, Rasa, custom)

Cualquier chatbot puede usar Pinky como backend de conocimiento:

- El chatbot recibe una pregunta del usuario → llama `POST /query` → devuelve la respuesta grounded con fuentes.
- Soporta múltiples dominios: cada instancia de Pinky es un dominio aislado (hípica, medicina, legal, etc.).

### 3. Pipelines de ETL inteligente (Airflow, Prefect, n8n)

Automatizar la ingesta de documentos:

- Un workflow en n8n/Airflow observa una carpeta S3 o Google Drive → cuando detecta nuevos archivos → los envía a `POST /documents/upload`.
- Otro workflow ejecuta `POST /index/incremental` periódicamente para mantener el índice actualizado.
- Idempotencia por checksum ya está implementada, así que los duplicados se rechazan automáticamente.

### 4. Asistentes de código / documentación (Copilot, Cursor, Warp)

Pinky puede ser el "cerebro de dominio" para un asistente de desarrollo:

- Ingestar documentación interna, ADRs, changelogs, runbooks.
- El asistente consulta `POST /query` para responder preguntas sobre la arquitectura o decisiones del proyecto.
- Implementar un nuevo adaptador para `DocumentGeneratorPort` que use un LLM para generar documentación automáticamente basada en código.

### 5. Plataformas de análisis de documentos (clasificación, extracción)

El pipeline de ingesta ya extrae entidades y relaciones. Se podría extender:

- Crear un `ClassificationExtractorPort` que clasifique documentos por tipo/tema al ingestarlos.
- Usar el grafo Neo4j para detectar patrones: qué entidades aparecen juntas, qué relaciones dominan un corpus.
- Exponer un endpoint `GET /graph/insights` que devuelva estadísticas del grafo.

### 6. Multi-agente con múltiples instancias (Fase 5 del roadmap)

El plan de despliegue por instancia/dominio permite:

- Una instancia Pinky para **medicina** (papers, diagnósticos).
- Otra para **hípica** (datos de caballos, rendimiento).
- Un **meta-agente** que decide a qué instancia consultar según la pregunta.

### 7. Generación automática de contenido

El endpoint `POST /documents/generate` + `DocumentGeneratorPort` se puede potenciar:

- Reemplazar `TemplateDocumentGeneratorAdapter` por un adaptador que use GPT-4/Claude para generar documentos completos basados en el grafo existente.
- Ejemplo: "genera un resumen ejecutivo del corpus actual" → consulta el grafo → genera documento → lo re-ingesta.

---

## Próximos pasos sugeridos para maximizar la integración con IA

1. **Exponer un SDK/cliente HTTP** — un paquete npm o Python con `BrainClient.ingest()`, `.query()`, `.search()` que simplifique la integración para cualquier agente o pipeline.
2. **Webhooks/eventos** — emitir eventos cuando un documento se ingesta o el grafo cambia, para que otros sistemas reaccionen (hoy solo existe el outbox interno).
3. **Streaming de respuestas** — implementar SSE en `POST /query` para que los chatbots puedan mostrar respuestas progresivas.
4. **API de grafo expuesta** — endpoints para consultar entidades y relaciones directamente, útil para visualizaciones y agentes que necesiten navegar el grafo.
5. **Adapter de embeddings intercambiable** — agregar OpenAI embeddings o Cohere como alternativa a Ollama, para entornos cloud sin GPU local.

---

> La arquitectura hexagonal que ya existe es exactamente la base correcta para todo esto — cada nuevo programa de IA se conecta implementando un adaptador contra un puerto existente o creando nuevos puertos sin tocar la lógica de negocio.
