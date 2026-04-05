# ADR-0003: Consistencia entre MongoDB y Neo4j mediante Outbox

- **Estado**: Superseded by ADR-0010
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

> Historico: este ADR ya no aplica. El sistema actual persiste directamente en Neo4j y no usa outbox.

## Contexto

La ingesta guarda datos en MongoDB y sincroniza hechos al grafo Neo4j. Si Neo4j falla, no se puede usar una transacción distribuida simple entre ambos motores.

## Decisión

Implementar patrón Outbox para sincronización de grafo:

1. Persistir documento/chunks en MongoDB.
2. Registrar evento `graph_sync_outbox` con payload serializado del grafo.
3. Intentar sincronización inmediata con Neo4j.
4. Si falla, mantener evento `FAILED/PENDING` para reintentos.
5. Reintento automático con worker periódico y endpoint manual `POST /outbox/retry`.

Estados de consistencia:

- Documento: `PENDING`/`SYNCED`/`FAILED` para sync de grafo.
- Evento outbox: `PENDING`/`FAILED`/`SYNCED`.

## Consecuencias

### Positivas

- Tolerancia a fallos de Neo4j sin perder datos de ingesta.
- Reprocesamiento auditable y controlado.
- Base para futura ejecución asíncrona por colas.

### Negativas

- Mayor complejidad de estado.
- Posible latencia entre escritura documental y disponibilidad en grafo.

## Alternativas consideradas

1. Fallar toda ingesta si Neo4j falla (descartado por pérdida de disponibilidad).
2. Two-phase commit distribuido (descartado por complejidad y costo operativo).
