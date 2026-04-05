# Changelog

## 2026-04-05

### Planned
- Se definio crear una GUI web administrativa dentro del mismo repo.
- Se decidio no usar Next.js.
- Se decidio implementar auth propia en NestJS.
- Se definio acceso inicial solo-admin mediante allowlist por email.
- Se decidio integrar Google y GitHub como proveedores OAuth.
- Se propuso `web/` como subproyecto aislado para minimizar impacto.
- Se definio una ruta tecnica de bajo churn con JWT en cookie HttpOnly.
- Se propuso mantener compatibilidad opcional con `X-API-Key` para clientes existentes.
- Se definio el MVP: login, dashboard, documentos, recursos y query.

### Implemented
- Se creo `docs/gui-admin-auth/` con README, backlog, tasks y changelog de la iniciativa.
- Se anadieron dependencias OAuth/JWT al backend Nest.
- Se implemento `src/modules/auth/**` con estrategias Google, GitHub y JWT.
- Se implemento la allowlist de admins por email via configuracion.
- Se anadieron los endpoints `GET /auth/providers`, `GET /auth/me` y `POST /auth/logout`.
- Se emitio JWT en cookie HttpOnly desde callbacks OAuth.
- Se adapto el guard existente para aceptar JWT web y mantener compatibilidad opcional con `X-API-Key`.
- Se protegieron `GET /documents`, las rutas ya anotadas con `@RequireApiKey()` y `GET /admin/overview`.
- Se protegieron las metricas en bootstrap HTTP cuando hay auth activa.
- Se anadio `GET /admin/overview` para alimentar el dashboard administrativo.
- Se creo `web/` con Vite, React, Router y TanStack Query.
- Se implementaron las paginas `login`, `dashboard`, `documents`, `resources` y `query`.
- Se anadieron tests e2e para `auth/me`, compatibilidad con API key y proteccion de rutas admin.
- Se actualizo la CI para instalar y compilar el frontend web.
- Se anadio `POST /auth/dev/login` para mockear OAuth en local y emitir la misma cookie JWT cuando `AUTH_ENABLE_DEV_LOGIN=true`.

### Pending execution
- Configurar credenciales OAuth reales para Google y GitHub en cada entorno.
- Decidir la estrategia final de despliegue del build web.
- Implementar acciones administrativas adicionales en la GUI, como borrado y reindexado desde la interfaz.
