# Brain Service - Documentacion de Arquitectura

Este espacio documenta las decisiones y evolucion de `pinky` (ingesta documental + GraphRAG).

## Fuente de verdad

Esta carpeta es la fuente oficial de verdad para arquitectura, plan de ejecucion y trazabilidad del servicio.

## Estructura

- `ADR/`: decisiones de arquitectura (Architecture Decision Records).
- `CHANGELOG.md`: registro cronológico de cambios implementados.
- `EXECUTION_PLAN.md`: plan operativo vigente por fases.

## Plan operativo

- [Execution Plan](EXECUTION_PLAN.md)
- [Frontend Execution Plan](FRONTEND_EXECUTION_PLAN.md)
- [Frontend Testing Strategy](FRONTEND_TESTING_STRATEGY.md)
- [Guía de integración rápida](INTEGRATION_GUIDE.md)
- [Proceso de subida a producción](PRODUCTION_RELEASE.md)

## ADRs actuales

- [ADR-0001 - Arquitectura Hexagonal](ADR/ADR-0001-hexagonal-architecture.md)
- [ADR-0002 - Persistencia Polyglot (Superseded)](ADR/ADR-0002-polyglot-persistence-mongo-neo4j.md)
- [ADR-0003 - Consistencia de Ingesta con Outbox (Superseded)](ADR/ADR-0003-ingestion-outbox-consistency.md)
- [ADR-0004 - Pipeline de Consulta GraphRAG](ADR/ADR-0004-graphrag-query-pipeline.md)
- [ADR-0005 - Ollama para embeddings y extracción estructurada](ADR/ADR-0005-ollama-embeddings-extraction.md)
- [ADR-0006 - Administración de corpus por API](ADR/ADR-0006-corpus-administration-api.md)
- [ADR-0007 - Hardening operacional (seguridad, confiabilidad e idempotencia)](ADR/ADR-0007-operational-hardening-security-reliability.md)
- [ADR-0008 - Aislamiento multi-tenant por corpus](ADR/ADR-0008-multi-tenant-corpus-isolation.md)
- [ADR-0010 - Persistencia Neo4j-Only](ADR/ADR-0010-neo4j-only-persistence.md)
- [ADR-0011 - Idempotencia fuerte de ingesta y delivery cloud automatizado](ADR/ADR-0011-idempotent-ingestion-and-cloud-delivery.md)

## Convención de actualización

1. Cada cambio estructural o tecnológico nuevo debe registrar o actualizar un ADR.
2. Cada avance de implementación se anota en `CHANGELOG.md` con fecha y alcance.
3. Si un ADR se reemplaza, se mantiene histórico y se marca como `Superseded`.
4. El plan activo para ejecución es `EXECUTION_PLAN.md`.
