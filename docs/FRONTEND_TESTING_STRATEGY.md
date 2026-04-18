# Frontend Testing Strategy - Remote Admin UI

## Objetivo

Mantener la UI remota consistente mientras se agregan operaciones reales sobre documentos, queries e indexación.

La estrategia cubre:

- tests unitarios de helpers, hooks y payload builders,
- tests de integración frontend para páginas y flujos con mocks,
- tests de integración backend cuando la UI dependa de endpoints nuevos o enriquecidos,
- smoke checks manuales para el flujo completo del operador.

## Principios

- Cada nueva capacidad visible debe traer tests desde el mismo sprint.
- No depender solo de verificación manual.
- Preferir tests de integración de pantalla para formularios y flujos completos.
- Mantener backend e2e existentes como red de seguridad para cambios contractuales.

## Stack recomendado para `web`

- `Vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`
- `msw`

## Pirámide de tests

### 1. Unit tests frontend

Cubren lógica aislada, rápida y determinista.

**Objetivos típicos**

- parse de errores API,
- build de payloads,
- normalización de filtros,
- serialización/deserialización de scope,
- persistencia local de estado,
- cálculo de alertas del dashboard.

**Ubicación sugerida**

- `web/src/**/*.test.ts`
- `web/src/**/*.test.tsx`

### 2. Integration tests frontend

Cubren interacción de usuario + hooks + React Query + routing + fetch mockeado.

**Objetivos típicos**

- login flow en modo UI,
- rutas protegidas,
- listado y filtrado de documentos,
- formularios de ingesta/upload/generate,
- delete con confirmación,
- query workbench,
- historial por `sessionId`,
- acciones de indexación,
- propagación de tenant/library scope.

**Ubicación sugerida**

- `web/src/**/*.integration.test.tsx`

### 3. Integration tests backend

Se mantienen en NestJS para proteger contratos que la UI consume.

**Objetivos típicos**

- `GET /documents/:id`
- `GET /admin/overview`
- `POST /index/rebuild`
- `POST /index/incremental`
- `GET /query/history/:sessionId`

**Ubicación actual**

- `test/*.e2e-spec.ts`

### 4. Smoke manual end-to-end

Se usa antes de merge a `main` cuando el cambio toca UX operativa relevante.

## Cobertura mínima por sprint

## Sprint 0

### Unit

- `api.ts`: parse de errores,
- query keys,
- invalidation helpers,
- componentes UI base.

### Integration frontend

- helper de requests,
- hook base con loading/success/error,
- confirm dialog.

## Sprint 1

### Unit

- serialización de scope,
- helpers de headers,
- parse de URL/search params.

### Integration frontend

- selector de scope,
- propagación a requests,
- navegación preserva scope.

## Sprint 2

### Unit

- filtros de documentos,
- validación de forms,
- parse metadata/params,
- builder `FormData`.

### Integration frontend

- documents list,
- ingest text,
- upload,
- generate,
- delete con confirm,
- invalidación de overview/documents.

### Integration backend

- `GET /documents/:id` si se implementa.

## Sprint 3

### Unit

- normalización payload query,
- formateo de `sourcesUsed`, `fastContext`, `truthFacts`,
- persistencia local de query state.

### Integration frontend

- query submit,
- render de resultado expandido,
- history por `sessionId`,
- uso de `libraryIds` y scope actual.

### Integration backend

- `GET /query/history/:sessionId`.

## Sprint 4

### Unit

- cálculo de alertas dashboard,
- payload de reindex,
- formatters de operations/runtime info.

### Integration frontend

- dashboard con overview degradado,
- operations page,
- rebuild/incremental con confirmación,
- render de release/runtime info.

### Integration backend

- `/admin/overview`
- `/index/rebuild`
- `/index/incremental`
- endpoint runtime si se agrega.

## Convenciones de test

- Un helper puro => test unitario.
- Un hook con React Query => test de integración ligera o hook test.
- Un formulario o página => test de integración frontend.
- Un endpoint nuevo o enriquecido => test e2e backend.
- Un flujo crítico de producción => smoke manual documentado.

## Setup pendiente para `web`

### Scripts esperados

Cuando se implemente el stack de tests, `web/package.json` debería exponer como mínimo:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### Infra compartida sugerida

- `web/src/test/setup.ts`
- `web/src/test/server.ts`
- `web/src/test/render.tsx`
- factories de payloads mock en `web/src/test/factories/`

## Smoke checks manuales obligatorios

Antes de cerrar bloques grandes de frontend, ejecutar manualmente:

1. Login exitoso.
2. Navegación por rutas protegidas.
3. Dashboard carga overview.
4. Documents lista documentos existentes.
5. Ingest text funciona.
6. Upload funciona.
7. Generate funciona.
8. Delete funciona con confirmación.
9. Query devuelve respuesta y fuentes.
10. Scope tenant/library se refleja en requests.
11. Rebuild/incremental funciona si ya existe UI.

## Criterio de aceptación global

- cada sprint de frontend sale con tests unitarios e integración acordes a su superficie,
- no se agregan features operativas sin protección mínima,
- los cambios contractuales UI/backend quedan cubiertos también por e2e Nest cuando corresponda.

## Referencias

- [Frontend Execution Plan](./FRONTEND_EXECUTION_PLAN.md)
- [Execution Plan general](./EXECUTION_PLAN.md)
- [Web Workspace README](../web/README.md)
