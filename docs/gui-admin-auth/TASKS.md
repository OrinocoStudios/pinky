# Tasks

## Fase 1 - Backend Auth Base

### Task 1.1
**Titulo**: Anadir dependencias de autenticacion backend

**Objetivo**:
Agregar las dependencias necesarias para OAuth, JWT y cookies en Nest.

**Archivos**:
- `package.json`

**Resultado esperado**:
- Dependencias de auth disponibles para implementar estrategias y guards.

### Task 1.2
**Titulo**: Extender configuracion tipada de auth

**Objetivo**:
Anadir el bloque `auth` en `configuration.ts` y sus variables de entorno asociadas.

**Archivos**:
- `src/config/configuration.ts`
- `.env.example` o documentacion equivalente

**Variables**:
- `AUTH_JWT_SECRET`
- `AUTH_JWT_EXPIRES_IN`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAME_SITE`
- `AUTH_ALLOWED_ADMIN_EMAILS`
- `AUTH_SUCCESS_URL`
- `AUTH_FAILURE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`

**Resultado esperado**:
- Config tipada y consumible por el nuevo modulo `auth`.

### Task 1.3
**Titulo**: Crear modulo `auth`

**Objetivo**:
Introducir el modulo `auth` como punto central de autenticacion y emision de JWT.

**Archivos nuevos**:
- `src/modules/auth/auth.module.ts`
- `src/modules/auth/application/auth.service.ts`
- `src/modules/auth/types/auth-user.type.ts`

**Resultado esperado**:
- Modulo reusable y desacoplado del resto de controladores.

## Fase 2 - OAuth Providers

### Task 2.1
**Titulo**: Implementar estrategia Google OAuth

**Archivos nuevos**:
- `src/modules/auth/infrastructure/strategies/google.strategy.ts`
- `src/modules/auth/guards/google-oauth.guard.ts`

**Resultado esperado**:
- Login por Google funcional y normalizado a `AuthUser`.

### Task 2.2
**Titulo**: Implementar estrategia GitHub OAuth

**Archivos nuevos**:
- `src/modules/auth/infrastructure/strategies/github.strategy.ts`
- `src/modules/auth/guards/github-oauth.guard.ts`

**Detalle clave**:
- Pedir scope `user:email`
- Resolver email verificado si no viene en perfil base

**Resultado esperado**:
- Login por GitHub funcional y usable para allowlist por email.

### Task 2.3
**Titulo**: Validar allowlist de emails admin

**Objetivo**:
Permitir acceso solo si el email autenticado existe en `AUTH_ALLOWED_ADMIN_EMAILS`.

**Archivos**:
- `src/modules/auth/application/auth.service.ts`

**Resultado esperado**:
- Usuarios fuera de allowlist reciben `403`.

## Fase 3 - JWT y endpoints auth

### Task 3.1
**Titulo**: Implementar estrategia JWT

**Archivos nuevos**:
- `src/modules/auth/infrastructure/strategies/jwt.strategy.ts`
- `src/modules/auth/guards/jwt-auth.guard.ts`
- `src/modules/auth/guards/admin-auth.guard.ts`

**Resultado esperado**:
- Validacion de JWT desde cookie HttpOnly y opcionalmente bearer token.

### Task 3.2
**Titulo**: Crear controlador de auth

**Archivos nuevos**:
- `src/modules/auth/presentation/auth.controller.ts`
- `src/modules/auth/decorators/current-user.decorator.ts`

**Endpoints**:
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/github`
- `GET /auth/github/callback`
- `GET /auth/me`
- `POST /auth/logout`
- opcional `GET /auth/providers`

**Resultado esperado**:
- Flujo OAuth end-to-end disponible para el frontend.

### Task 3.3
**Titulo**: Setear y limpiar cookie de autenticacion

**Archivos**:
- `src/modules/auth/presentation/auth.controller.ts`

**Resultado esperado**:
- Login crea cookie segura
- Logout la invalida correctamente

## Fase 4 - Integracion con backend existente

### Task 4.1
**Titulo**: Preparar bootstrap HTTP para cookies y CORS

**Archivos**:
- `src/main.ts`

**Cambios esperados**:
- registrar `cookie-parser`
- habilitar `credentials: true`
- usar `CORS_ORIGINS` explicitos
- permitir header `Authorization`

### Task 4.2
**Titulo**: Sustituir internamente `@RequireApiKey()` por un guard compuesto

**Archivos**:
- `src/common/decorators/require-api-key.decorator.ts`
- `src/common/guards/api-key.guard.ts` o guard nuevo equivalente

**Objetivo**:
- aceptar JWT web
- mantener compatibilidad opcional con `X-API-Key`

**Resultado esperado**:
- Minimo churn sobre controladores existentes

### Task 4.3
**Titulo**: Proteger endpoints administrativos

**Archivos**:
- `src/modules/documents/presentation/documents.controller.ts`
- `src/modules/query/presentation/query.controller.ts`
- `src/modules/index/presentation/index.controller.ts`

**Endpoints a proteger**:
- `GET /documents`
- `POST /documents/text`
- `POST /documents/generate`
- `POST /documents/upload`
- `DELETE /documents/:id`
- `POST /query`
- `POST /summarize`
- `GET /query/history/:sessionId`
- `POST /index/rebuild`
- `POST /index/incremental`

## Fase 5 - Frontend `web/`

### Task 5.1
**Titulo**: Crear proyecto frontend base

**Archivos nuevos esperados**:
- `web/package.json`
- `web/vite.config.ts`
- `web/tsconfig.json`
- `web/index.html`
- `web/src/main.tsx`

**Resultado esperado**:
- Frontend arrancando en local de forma aislada

### Task 5.2
**Titulo**: Crear infraestructura de app frontend

**Archivos nuevos**:
- `web/src/app/router.tsx`
- `web/src/app/query-client.ts`
- `web/src/lib/api.ts`
- `web/src/lib/auth.ts`
- `web/src/components/protected-route.tsx`
- `web/src/components/app-shell.tsx`

**Resultado esperado**:
- Base reutilizable para el resto de paginas

### Task 5.3
**Titulo**: Implementar login page

**Archivos**:
- `web/src/pages/login.tsx`

**Resultado esperado**:
- Botones de login Google/GitHub apuntando al backend

### Task 5.4
**Titulo**: Implementar bootstrap de sesion

**Objetivo**:
- consultar `GET /auth/me`
- hidratar usuario actual
- redirigir segun estado de autenticacion

## Fase 6 - Dashboard y recursos

### Task 6.1
**Titulo**: Crear dashboard inicial

**Archivos**:
- `web/src/pages/dashboard.tsx`

**Fuentes de datos**:
- `GET /health`
- `GET /documents`

**Widgets MVP**:
- estado general
- Neo4j
- proveedor LLM
- uptime
- resumen documental por estado
- documentos recientes

### Task 6.2
**Titulo**: Crear pagina de recursos

**Archivos**:
- `web/src/pages/resources.tsx`

**Resultado esperado**:
- Vista operativa del estado del sistema

### Task 6.3
**Titulo**: Evaluar endpoint agregado `GET /admin/overview`

**Objetivo**:
Reducir logica de agregacion en frontend si el dashboard lo necesita.

## Fase 7 - Documentos y Query

### Task 7.1
**Titulo**: Implementar pagina de documentos

**Archivos**:
- `web/src/pages/documents.tsx`

**Resultado esperado**:
- Tabla con estados, metadata y fechas

### Task 7.2
**Titulo**: Implementar pagina de query

**Archivos**:
- `web/src/pages/query.tsx`

**Resultado esperado**:
- Enviar preguntas, mostrar respuesta y fuentes

## Fase 8 - Calidad

### Task 8.1
**Titulo**: Anadir tests de auth backend

**Cobertura minima**:
- login permitido por email admin
- rechazo por email no permitido
- `GET /auth/me`
- logout

### Task 8.2
**Titulo**: Anadir tests de proteccion de endpoints

**Cobertura minima**:
- acceso sin auth falla
- acceso con JWT admin funciona
- acceso con `X-API-Key` funciona si se mantiene compatibilidad

### Task 8.3
**Titulo**: Revisar CI para frontend

**Objetivo**:
Decidir si se anaden jobs separados para `web/` o se mantiene fuera de CI hasta cerrar MVP.
