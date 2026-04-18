# Pinky Web

UI administrativa del servidor remoto `pinky`.

## Objetivo

Esta app provee una consola web para:

- autenticarse como admin,
- inspeccionar estado del sistema,
- operar el corpus documental,
- ejecutar queries GraphRAG,
- y, progresivamente, administrar operaciones del backend remoto.

## Stack actual

- React 19
- Vite
- React Router
- React Query

## Estado actual

Ya existe base funcional para:

- login web,
- shell protegida,
- dashboard,
- listado simple de documentos,
- resources/health,
- query básica.

Pendiente principal:

- documents operations completas,
- scoping tenant/library,
- query workbench expandido,
- operations UI,
- suite de tests frontend.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Variables esperadas

- `VITE_API_BASE_URL`

Si no está definida, la app asume mismo origen para requests al backend.

## Siguiente roadmap

Ver documentos de planificación técnica:

- [`../docs/FRONTEND_EXECUTION_PLAN.md`](../docs/FRONTEND_EXECUTION_PLAN.md)
- [`../docs/FRONTEND_TESTING_STRATEGY.md`](../docs/FRONTEND_TESTING_STRATEGY.md)

## Convenciones para próximas iteraciones

- mover contratos API compartidos a `src/lib/`
- mover fetch/mutations a hooks `React Query`
- introducir tests frontend antes de ampliar superficie operativa
- mantener scope tenant/library explícito en UX y requests

## Smoke checks mínimos

1. Login exitoso.
2. Dashboard carga.
3. Documents carga.
4. Query responde.
5. Logout limpia sesión.
