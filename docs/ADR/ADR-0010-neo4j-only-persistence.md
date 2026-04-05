# ADR-0010: Persistencia Neo4j-Only

- **Estado**: Accepted
- **Fecha**: 2026-04-04
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

La etapa polyglot inicial introdujo complejidad operativa, duplicacion de estado y documentacion desalineada.

El sistema ya usa Neo4j para:

- grafo de conocimiento;
- busqueda vectorial sobre `Chunk`;
- scoping multi-tenant y por library.

La arquitectura necesitaba simplificarse para que el backend de persistencia fuera unico y coherente con el modelo de conocimiento del producto.

## Decision

Adoptar Neo4j como unico backend persistente de Pinky.

Neo4j pasa a almacenar:

- `Document`;
- `Chunk`;
- `Entity`;
- relaciones `HAS_CHUNK`, `MENTIONS`, `RELATED`;
- `ChatMessage` para historial de sesion.

MongoDB, Redis y el patron outbox salen del runtime activo.

## Consecuencias

### Positivas

- Menor complejidad operativa y de despliegue.
- Un solo source of truth para documentos, chunks, grafo e historial.
- Menos riesgo de inconsistencias entre motores.
- Mejor alineacion con un producto centrado en conocimiento conectado.

### Negativas

- Las queries administrativas deben modelarse e indexarse bien en Neo4j.
- El texto crudo y metadata tambien pasan a Neo4j, con costo de almacenamiento asociado.

## Alternativas consideradas

1. Mantener MongoDB + Neo4j.
2. Volver a MongoDB-only.
3. Introducir un tercer motor para search o chat history.

Se descartan por aumentar complejidad sin aportar valor suficiente al estado actual del producto.
