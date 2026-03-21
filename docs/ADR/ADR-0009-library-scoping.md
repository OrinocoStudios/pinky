# ADR-0009: Library Scoping — segundo nivel de organización de datos

- **Estado**: Accepted (implementado)
- **Fecha**: 2026-03-21
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

Con el multi-tenant (ADR-0008) resuelto, Pinky puede aislar datos por organización (`tenantId`). Sin embargo, dentro de un mismo tenant necesitamos organizar documentos en **agrupaciones lógicas** que representen distintos corpus de conocimiento.

Ejemplo concreto — clínica médica:

```
Clínica (tenantId: "clinica-salud")
├── Biblioteca RAG Global (libraryId: "global-medical-library")
│   └── PDFs médicos compartidos entre doctores
└── Pacientes
    ├── Paciente A (libraryId: "patient:abc123")
    │   └── Historias clínicas, análisis, documentos
    └── Paciente B (libraryId: "patient:xyz789")
        └── ...
```

Otros dominios siguen el mismo patrón:
- **Trading**: `strategy:btc-2026`, `macro-analysis`, `global-indicators`
- **Software**: `project:pinky`, `architecture-docs`, `runbooks`
- **Literatura**: `library:fiction`, `library:non-fiction`

La capa de negocio (servicio externo que consume Pinky) decide qué significa cada `libraryId`. Pinky no necesita saber la semántica — solo filtra.

## Decisión

### Diseño: `libraryId` como campo aditivo y opcional

Agregar `libraryId?: string` a los modelos de dominio (`DocumentRecord`, `DocumentChunk`, `GraphSyncOutboxEvent`) y propagar por toda la pipeline.

### Contrato de API

- Header: `X-Library-Id: <string>` (opcional en todos los endpoints)
- Body: `libraryIds: string[]` en `POST /query` para consultas multi-biblioteca
- Precedencia: `libraryIds` del body > `X-Library-Id` del header

### Persistencia

**MongoDB**:
- Campos `libraryId` en `documents`, `chunks` y `graph_sync_outbox`
- Índices compuestos: `{ tenantId, libraryId, createdAt }`, `{ libraryId, documentId }`, `{ tenantId, libraryId, checksum }` (unique)

**Neo4j**:
- Propiedad `libraryId` en nodos `Document`, `Entity` y relaciones `MENTIONS`, `RELATED`
- Filtro por lista `libraryIds IN [...]` en queries de entidades y relaciones

### Compatibilidad hacia atrás

- Sin `X-Library-Id`: el sistema opera exactamente igual que antes
- No hay flag de configuración `ENABLE_LIBRARY_SCOPE` — el campo simplemente no se filtra cuando es `null`/`undefined`
- Los tests E2E existentes pasan sin cambios

## Alternativas consideradas

### A. Crear una entidad `Library` con CRUD propio

**Rechazada**: agrega complejidad innecesaria al motor RAG. La responsabilidad de gestionar bibliotecas como entidades de negocio (con metadatos, permisos, etc.) corresponde a la capa de negocio, no al motor RAG.

### B. Usar `metadata.libraryId` en vez de campo dedicado

**Rechazada**: los campos de metadata no se indexan ni se usan en filtros de queries de Mongo/Neo4j. Un campo dedicado permite índices eficientes y filtros nativos.

### C. Usar `tenantId` compuesto (e.g. `clinica-salud::patient:abc123`)

**Rechazada**: rompe el aislamiento por tenant y hace imposible las consultas multi-biblioteca dentro de un mismo tenant.

## Consecuencias

### Positivas

- Un solo deployment sirve múltiples corpus organizados jerárquicamente
- Las queries pueden cruzar bibliotecas (e.g. consultar global + paciente)
- El motor RAG sigue siendo genérico — no sabe nada de clínicas, pacientes, ni trading
- 100% backward-compatible

### Negativas / costos

- Más índices en MongoDB (costo de escritura marginal)
- Más propiedades en Neo4j (costo de almacenamiento marginal)
- La capa de negocio es responsable de la consistencia semántica de los `libraryId`

## Referencias

- ADR-0008: Multi-tenant corpus isolation
- `docs/API_REFERENCE.md` — sección "Library Scope Header"
- `docs/INTEGRATION_GUIDE.md` — sección 9
