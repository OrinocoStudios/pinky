# GUI Admin Auth

Implementacion de una GUI web para Pinky dentro del mismo repo, con autenticacion propia en NestJS, login con Google y GitHub, y acceso inicial restringido a administradores mediante allowlist de emails.

## Objetivo

Construir una interfaz web administrativa para consultar datos del sistema y visualizar el estado de los recursos, manteniendo una base tecnica simple y con el menor impacto posible sobre el backend actual.

## Decisiones cerradas

- La GUI vivira dentro del mismo repo por ahora.
- No se utilizara Next.js.
- El frontend se implementara en `web/` con React + Vite + TypeScript.
- La autenticacion sera propia en NestJS.
- El acceso inicial sera solo para administradores, usando allowlist por email.
- Se integraran Google y GitHub como proveedores OAuth.
- No se implementaran roles y permisos completos en esta primera fase.
- Se prioriza una ruta de bajo churn sobre el backend existente.

## Arquitectura objetivo

- `web/`: frontend administrativo.
- `src/modules/auth/**`: nuevo modulo de autenticacion OAuth/JWT.
- Guard compuesto en backend para aceptar JWT web y, opcionalmente, `X-API-Key` legacy.
- Dashboard inicial basado en `GET /health` y `GET /documents`.
- Posible endpoint agregado posterior: `GET /admin/overview`.

## Alcance del MVP

- Login con Google y GitHub.
- Allowlist de emails admin.
- Endpoint `GET /auth/me`.
- Endpoint `POST /auth/logout`.
- Endpoint `POST /auth/dev/login` solo para desarrollo local cuando `AUTH_ENABLE_DEV_LOGIN=true`.
- Proteccion de endpoints administrativos.
- Dashboard inicial con estado operativo.
- Vista de documentos.
- Vista de recursos.
- Vista de query.

## Fuera de alcance por ahora

- RBAC completo.
- CRUD de usuarios.
- Persistencia de usuarios.
- Separacion del frontend a otro repo.
- Migracion completa a workspaces o monorepo formal.
