# Backlog

## Estado
- in-progress

## Epic 1: Auth propia en NestJS
- [x] Crear modulo `auth` en NestJS
- [x] Integrar OAuth con Google
- [x] Integrar OAuth con GitHub
- [x] Resolver email verificado en GitHub via API `/user/emails`
- [x] Implementar validacion por allowlist de emails admin
- [x] Implementar JWT firmado por Nest
- [x] Emitir JWT en cookie HttpOnly
- [x] Crear endpoint `GET /auth/me`
- [x] Crear endpoint `POST /auth/logout`
- [x] Crear endpoint opcional `GET /auth/providers`

## Epic 2: Proteccion de la API administrativa
- [x] Crear guard compuesto para JWT + compatibilidad opcional con `X-API-Key`
- [x] Mantener el decorador `@RequireApiKey()` como alias de compatibilidad
- [x] Proteger `GET /documents`
- [x] Revisar y proteger `GET /metrics`
- [x] Mantener `GET /health` publico salvo decision contraria
- [x] Validar respuestas `401` y `403` correctas

## Epic 3: Configuracion y bootstrap HTTP
- [x] Extender `configuration.ts` con bloque `auth`
- [x] Anadir `cookie-parser`
- [x] Ajustar CORS para credenciales
- [x] Configurar cookies seguras para local y produccion
- [x] Documentar variables de entorno nuevas

## Epic 4: GUI web en `web/`
- [x] Crear proyecto `web/` con Vite + React + TypeScript
- [x] Anadir routing base
- [x] Anadir cliente HTTP comun
- [x] Anadir bootstrap de sesion usando `/auth/me`
- [x] Implementar `ProtectedRoute`
- [x] Implementar `AppShell`
- [x] Implementar pagina de login
- [x] Implementar logout

## Epic 5: Dashboard y operacion
- [x] Construir dashboard inicial con `GET /health`
- [x] Mostrar estado de Neo4j
- [x] Mostrar proveedor LLM configurado
- [x] Mostrar uptime
- [x] Mostrar resumen documental por estado
- [x] Mostrar documentos recientes
- [x] Evaluar endpoint agregado `GET /admin/overview`

## Epic 6: Gestion de documentos
- [x] Crear pagina de documentos
- [x] Mostrar tabla con estados y metadata
- [x] Anadir busqueda/filtro local simple
- [ ] Preparar acciones futuras de borrado y reindexado

## Epic 7: Query y recursos
- [x] Crear pagina de query
- [x] Mostrar respuesta y fuentes
- [x] Crear pagina de recursos
- [x] Mostrar estado operativo y latencias conocidas

## Epic 8: Calidad y despliegue
- [x] Anadir tests de auth backend
- [x] Anadir tests minimos de proteccion de endpoints
- [x] Revisar CI para incluir validaciones del frontend
- [ ] Decidir como desplegar el build web en una fase posterior
