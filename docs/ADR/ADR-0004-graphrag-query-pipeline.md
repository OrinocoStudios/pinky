# ADR-0004: Pipeline de consulta GraphRAG por etapas

- **Estado**: Accepted
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

El servicio debe responder preguntas con:

- contexto rápido recuperado desde chunks documentales;
- hechos verificables del grafo;
- generación final grounded.

## Decisión

Implementar pipeline de consulta en capas:

1. `POST /query` recibe pregunta y `entityHints` opcionales.
2. Recuperación híbrida inicial de chunks (score semántico + lexical).
3. Recuperación de entidades/relaciones desde Neo4j.
4. Construcción de prompt grounded (contexto + hechos).
5. Generación de respuesta vía puerto `AnswerGeneratorPort`.

En fase inicial se usa adaptador local para generación, con reemplazo posterior por proveedor LLM.

## Consecuencias

### Positivas

- Flujo extensible a modelos externos sin cambiar caso de uso.
- Separación clara entre retrieval y generation.
- Trazabilidad de la respuesta por evidencia textual y de grafo.

### Negativas

- Calidad inicial limitada por extractor/embeddings temporales.
- Requiere mejoras iterativas para alcanzar precisión productiva.

## Alternativas consideradas

1. Prompt solo con vector search (sin grafo).
2. Consulta solo grafo (sin contexto textual).

Se descartan por menor robustez ante consultas ambiguas o información parcial.
