# ADR-0001: Arquitectura Hexagonal para Brain Service

- **Estado**: Accepted
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

El servicio requiere evolucionar por etapas (ingesta, sincronización de grafo, recuperación híbrida, LLM integration) y preservar flexibilidad para cambiar motores de infraestructura sin reescribir casos de uso.

## Decisión

Adoptar arquitectura hexagonal con separación por capas:

- **Domain**: modelos y puertos.
- **Application**: casos de uso (`ingest`, `query`).
- **Infrastructure**: adaptadores (`mongo`, `neo4j`, `elasticsearch`, extractores de archivos, generador de respuesta).
- **Presentation**: controladores API.

La inversión de dependencias se implementa con tokens DI de NestJS y puertos explícitos.

## Consecuencias

### Positivas

- Menor acoplamiento entre negocio e infraestructura.
- Sustitución controlada de adaptadores (ej. Mongo a Elasticsearch en búsqueda).
- Mejor testabilidad por mocks de puertos.

### Negativas

- Mayor cantidad de archivos/abstracciones al inicio.
- Curva de aprendizaje para nuevos desarrolladores.

## Alternativas consideradas

1. Arquitectura por capas clásica (controller-service-repository) sin puertos.
2. Enfoque acoplado a SDK/driver por módulo.

Se descartan por menor capacidad de evolución para el roadmap multi-adapter.
