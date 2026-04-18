# Frontend Execution Plan - Remote Admin UI

## Objetivo

Convertir `pinky/web` en una consola operativa real para el servidor remoto, sin romper consistencia con backend, auth ni scoping multi-tenant/multi-library.

Este plan separa el trabajo de frontend del roadmap general para poder ejecutarlo por sprints técnicos pequeños, con criterios de aceptación y cobertura de tests definidos desde el inicio.

## Estado actual

La UI remota ya tiene base funcional:

- login web con Google, GitHub y dev login opcional,
- sesión por cookie/JWT,
- shell con navegación protegida,
- dashboard básico,
- listado simple de documentos,
- query page mínima,
- resources page basada en `GET /health`.

Todavía faltan capacidades operativas clave:

- crear/subir/generar/borrar documentos desde UI,
- scoping explícito por tenant/library,
- detalle documental,
- workbench de query más completo,
- acciones de indexación,
- tests frontend.

## Principios

- Mantener cambios pequeños y verticales.
- No duplicar contratos API entre páginas.
- Introducir tests junto a cada capa nueva.
- Exponer scoping como concepto explícito de producto, no como detalle oculto de headers.
- No agregar complejidad visual innecesaria antes de cerrar flujo operativo.

## Sprint 0 - Infra UI base

### Task 0.1 - Normalizar contratos API frontend

**Objetivo**

Centralizar contratos y tipos consumidos por `web`, eliminando tipos inline repetidos en páginas.

**Trabajo esperado**

- extraer tipos de auth,
- extraer tipos de documents,
- extraer tipos de admin overview,
- extraer tipos de query e index operations,
- centralizar parse y surface de errores HTTP.

**Archivos probables**

- `web/src/lib/api.ts`
- `web/src/lib/auth.ts`
- `web/src/lib/types.ts`
- `web/src/lib/contracts.ts`

**Tests a escribir**

- unit: parse de error JSON,
- unit: parse de error texto,
- unit: manejo de `204`,
- integration frontend: helper de requests con `credentials: include` y errores mapeados.

**Criterio de aceptación**

- no quedan tipos inline relevantes en páginas actuales,
- la capa API expone errores consistentes y reutilizables.

### Task 0.2 - Crear capa de hooks React Query

**Objetivo**

Separar fetch/mutations de la capa de vista y unificar query keys e invalidaciones.

**Hooks iniciales sugeridos**

- `useCurrentUser`
- `useAdminOverview`
- `useDocuments`
- `useRunQuery`
- `useDeleteDocument`
- `useIngestTextDocument`
- `useUploadDocument`
- `useGenerateDocument`
- `useReindex`

**Archivos probables**

- `web/src/app/query-client.ts`
- `web/src/hooks/*.ts`

**Tests a escribir**

- unit: query keys,
- unit: invalidation keys,
- integration frontend: hook loading/success/error con mocks.

**Criterio de aceptación**

- páginas dejan de llamar `apiFetch` directo salvo casos puntuales,
- invalidaciones quedan centralizadas.

### Task 0.3 - Crear componentes UI base reutilizables

**Objetivo**

Unificar estados de carga, error, vacío y confirmación.

**Componentes sugeridos**

- `PageStateLoading`
- `PageStateError`
- `EmptyState`
- `ConfirmDialog`
- `StatusBadge`
- `ScopeBadge`

**Archivos probables**

- `web/src/components/ui/*.tsx`
- `web/src/styles.css`

**Tests a escribir**

- unit: render simple,
- unit: callbacks de confirm/cancel,
- integration frontend: apertura/cierre de confirm dialog.

**Criterio de aceptación**

- estados repetidos desaparecen de páginas,
- confirmaciones peligrosas usan componente único.

## Sprint 1 - Scope tenant/library

### Task 1.1 - Diseñar modelo de scope global

**Objetivo**

Definir cómo representar `tenantId` y `libraryId` en frontend y requests.

**Decisión recomendada**

- estado global en shell,
- reflejo en URL/search params,
- headers derivados automáticamente al hacer requests.

**Archivos probables**

- `web/src/lib/scope.ts`
- `web/src/app/scope-context.tsx`
- `web/src/lib/api.ts`

**Tests a escribir**

- unit: serialización/deserialización de scope,
- integration frontend: cambio de scope modifica headers,
- integration frontend: navegación conserva scope.

**Criterio de aceptación**

- cualquier pantalla protegida puede conocer y usar scope actual,
- tenant/library dejan de ser concepto invisible.

### Task 1.2 - Implementar selector de scope en `AppShell`

**Objetivo**

Permitir que el operador seleccione tenant/library activas desde la consola.

**Trabajo esperado**

- selector visible,
- estado actual legible,
- reset rápido,
- feedback cuando no hay scope activo.

**Archivos probables**

- `web/src/components/app-shell.tsx`
- `web/src/components/scope-selector.tsx`
- `web/src/styles.css`

**Tests a escribir**

- unit: render/control de inputs,
- integration frontend: selector refresca dashboard/documents/query.

**Criterio de aceptación**

- shell expone scope activo,
- requests backend heredan scope sin lógica duplicada por página.

## Sprint 2 - Documents Operations

### Task 2.1 - Mejorar tabla Documents

**Objetivo**

Convertir listado actual en una vista operativa útil.

**Trabajo esperado**

- filtros por texto,
- filtros por status,
- filtros por graph sync status,
- empty state,
- conteo visible de resultados.

**Archivos probables**

- `web/src/pages/documents.tsx`
- `web/src/lib/document-filters.ts`

**Tests a escribir**

- unit: función de filtrado,
- integration frontend: filtros afectan tabla.

**Criterio de aceptación**

- operador puede localizar rápido un documento por id, título, tenant o library.

### Task 2.2 - Formulario de ingesta por texto

**Objetivo**

Crear documentos manuales desde UI usando `POST /documents/text`.

**Campos**

- `title`
- `rawText`
- `metadata` JSON opcional

**Archivos probables**

- `web/src/pages/documents.tsx`
- `web/src/components/document-text-form.tsx`

**Tests a escribir**

- unit: validación de campos,
- unit: parse de metadata,
- integration frontend: submit feliz/error,
- integration frontend: invalidación de lista y dashboard.

**Criterio de aceptación**

- nueva ingesta aparece en lista y overview sin recargar manualmente.

### Task 2.3 - Formulario de upload

**Objetivo**

Subir archivos reales desde UI usando `POST /documents/upload`.

**Campos**

- archivo,
- título opcional,
- metadata opcional.

**Archivos probables**

- `web/src/components/document-upload-form.tsx`
- hooks de mutation en `web/src/hooks/`

**Tests a escribir**

- unit: builder `FormData`,
- integration frontend: submit feliz,
- integration frontend: archivo faltante,
- integration frontend: error backend.

**Criterio de aceptación**

- operador puede subir un documento sin salir de la consola.

### Task 2.4 - Formulario de generate

**Objetivo**

Permitir creación vía `useCaseId` desde UI con `POST /documents/generate`.

**Campos**

- `useCaseId`
- `title`
- `params` JSON opcional

**Archivos probables**

- `web/src/components/document-generate-form.tsx`

**Tests a escribir**

- unit: parse de params JSON,
- integration frontend: submit feliz/error.

**Criterio de aceptación**

- casos de documento generado quedan disponibles para operaciones de negocio sin usar curl.

### Task 2.5 - Delete document con confirmación

**Objetivo**

Exponer borrado controlado desde la tabla o detalle.

**Archivos probables**

- `web/src/pages/documents.tsx`
- `web/src/components/ui/ConfirmDialog.tsx`

**Tests a escribir**

- unit: callback de confirmación,
- integration frontend: delete feliz,
- integration frontend: error `404/500`,
- integration frontend: invalidación de queries.

**Criterio de aceptación**

- no existe borrado sin confirmación explícita,
- la UI refleja el cambio inmediatamente tras éxito.

### Task 2.6 - Vista detalle de documento

**Objetivo**

Mostrar datos completos del documento en una ruta dedicada.

**Dependencia**

- probable soporte backend `GET /documents/:id`.

**Ruta sugerida**

- `/documents/:id`

**Archivos probables**

- `web/src/pages/document-detail.tsx`
- `web/src/app/router.tsx`

**Tests a escribir**

- unit: formato de metadata/source/status,
- integration frontend: fetch detalle feliz/error.

**Criterio de aceptación**

- un operador puede inspeccionar estado, scope, metadata y timestamps de un documento específico.

## Sprint 3 - Query Workbench

### Task 3.1 - Extender formulario de query

**Objetivo**

Pasar de una textarea simple a un form que refleje mejor capacidades del backend.

**Campos**

- `sessionId`
- `topK`
- `entityHints`
- `libraryIds`

**Archivos probables**

- `web/src/pages/query.tsx`
- `web/src/components/query-form.tsx`

**Tests a escribir**

- unit: normalización de payload,
- integration frontend: submit con opciones,
- integration frontend: errores de validación.

**Criterio de aceptación**

- la página permite ejecutar queries contextualizadas y reproducibles.

### Task 3.2 - Expandir resultado de query

**Objetivo**

Hacer visible el contexto devuelto por GraphRAG, no solo el answer final.

**Trabajo esperado**

- panel answer,
- panel sources,
- panel `fastContext`,
- panel `truthFacts`,
- métricas de modelo/tokens.

**Archivos probables**

- `web/src/pages/query.tsx`
- `web/src/components/query-result.tsx`

**Tests a escribir**

- unit: render de listas vacías/no vacías,
- integration frontend: respuesta completa renderiza todos los paneles.

**Criterio de aceptación**

- la página ayuda a depurar calidad de respuesta, no solo a verla.

### Task 3.3 - Historial por `sessionId`

**Objetivo**

Visualizar conversación o historial técnico usando `GET /query/history/:sessionId`.

**Archivos probables**

- `web/src/components/query-history.tsx`
- `web/src/pages/query.tsx`

**Tests a escribir**

- unit: ordenamiento/grouping de mensajes,
- integration frontend: cambiar `sessionId` refresca historial.

**Criterio de aceptación**

- un operador puede reabrir una sesión y seguir razonamiento previo.

### Task 3.4 - Persistencia UX local

**Objetivo**

Recordar última query y opciones recientes sin tocar backend.

**Archivos probables**

- `web/src/lib/query-state.ts`

**Tests a escribir**

- unit: save/restore de estado local,
- integration frontend: reload conserva estado.

**Criterio de aceptación**

- la experiencia no se resetea por completo al refrescar la pantalla.

## Sprint 4 - Admin / Operations

### Task 4.1 - Mejorar Dashboard

**Objetivo**

Convertir overview en tablero con valor operativo real.

**Trabajo esperado**

- quick actions,
- alertas de documentos en error,
- alertas de Neo4j down,
- mejor visualización de overview.

**Archivos probables**

- `web/src/pages/dashboard.tsx`

**Tests a escribir**

- unit: cálculo de alertas,
- integration frontend: render por estados de overview.

**Criterio de aceptación**

- dashboard deja de ser solo ornamental y ayuda a tomar acción.

### Task 4.2 - Convertir Resources en Operations

**Objetivo**

Usar la página actual de recursos como superficie de operación y observabilidad.

**Trabajo esperado**

- health más legible,
- provider/config visible,
- estados operativos relevantes,
- posible renombre a `Operations`.

**Archivos probables**

- `web/src/pages/resources.tsx`

**Tests a escribir**

- unit: mapping de servicios,
- integration frontend: render de estados up/down.

**Criterio de aceptación**

- un operador puede ver de inmediato si el servicio está sano o degradado.

### Task 4.3 - Exponer acciones de index

**Objetivo**

Permitir `rebuild` e `incremental` desde UI.

**Campos**

- modo,
- limit,
- scope actual.

**Archivos probables**

- `web/src/pages/resources.tsx`
- `web/src/components/reindex-panel.tsx`

**Tests a escribir**

- unit: payload por modo,
- integration frontend: confirm + success/error.

**Criterio de aceptación**

- indexación puede dispararse desde la consola con feedback claro.

### Task 4.4 - Mostrar runtime/release info

**Objetivo**

Hacer visible versión desplegada, commit o image tag si backend lo expone.

**Dependencia**

- posible endpoint backend nuevo.

**Tests a escribir**

- unit: formatting runtime info,
- integration frontend: payload renderizado.

**Criterio de aceptación**

- operador sabe exactamente qué release está corriendo.

## Sprint 5 - Gaps backend para soportar UI

### Task 5.1 - Agregar `GET /documents/:id`

**Objetivo**

Habilitar detalle documental desde frontend.

**Archivos probables backend**

- `src/modules/documents/presentation/documents.controller.ts`
- `src/modules/documents/domain/ports/document-repository.port.ts`
- repository Neo4j

**Tests backend**

- unit: found/not found,
- integration backend: `200/404`.

### Task 5.2 - Enriquecer `/admin/overview` si hace falta

**Objetivo**

Exponer más señales útiles para dashboard/operations.

**Tests backend**

- unit: mapper overview,
- integration backend: shape y auth.

### Task 5.3 - Endpoint runtime/release info opcional

**Objetivo**

Exponer commit SHA, image tag o build time para la consola.

**Tests backend**

- unit: config fallback,
- integration backend: route + auth.

## Orden recomendado de ejecución

1. Task 0.1
2. Task 0.2
3. Task 0.3
4. Task 1.1
5. Task 1.2
6. Task 2.1
7. Task 2.2
8. Task 2.3
9. Task 2.4
10. Task 2.5
11. Task 5.1
12. Task 2.6
13. Task 3.1
14. Task 3.2
15. Task 3.3
16. Task 3.4
17. Task 4.1
18. Task 4.2
19. Task 4.3
20. Task 5.2
21. Task 5.3
22. Task 4.4

## Criterios de salida por bloque

- **Infra lista**: páginas sin lógica HTTP repetida ni errores inconsistentes.
- **Scope listo**: tenant/library impactan requests reales y navegación.
- **Documents listo**: crear/subir/generar/borrar/inspeccionar desde UI.
- **Query listo**: workbench usable con historial y contexto visible.
- **Ops listo**: overview, health e indexación accionables desde UI.

## Referencias

- [Execution Plan general](./EXECUTION_PLAN.md)
- [Frontend Testing Strategy](./FRONTEND_TESTING_STRATEGY.md)
- [Web Workspace README](../web/README.md)
