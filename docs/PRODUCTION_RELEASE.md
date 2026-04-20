# Proceso de Subida a Produccion

Guia operativa para llevar `pinky` a produccion usando GitHub Actions, GHCR y Dokploy.

## Objetivo

Estandarizar un flujo repetible de release con:

- validacion tecnica antes de merge,
- build y publicacion automatica en `ghcr.io`,
- redeploy automatico en Dokploy,
- verificaciones post-deploy y rollback rapido.

## Requisitos previos

Antes de hacer una subida a produccion, validar:

- rama `main` protegida,
- workflows de GitHub Actions habilitados,
- permisos `Read and write` para `GITHUB_TOKEN`,
- secret `DOKPLOY_WEBHOOK_URL` configurado en GitHub,
- credenciales GHCR configuradas en Dokploy si paquete es privado,
- variables de entorno de produccion cargadas en Dokploy,
- `BRAIN_IMAGE` configurado idealmente como `ghcr.io/orinocostudios/pinky:main` o un tag `sha-<commit>`.

## Variables criticas de produccion

Como minimo, revisar estas variables en Dokploy:

- `API_KEY`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `LLM_PROVIDER`
- `AI_URL` o `OPENAI_*` o `ANTHROPIC_*`
- variables de auth si el entorno usa login web

No usar valores por defecto inseguros como `change-me-in-production`.

## Flujo de release

### 1. Preparacion local

Antes de abrir o mergear PR a `main`:

```bash
npm ci
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Si se tocó contenedor o dependencias del backend:

```bash
docker build -f Dockerfile.prod -t pinky-release-check .
```

Checklist:

- build verde,
- tests unitarios verdes,
- tests e2e/integracion verdes,
- cambios de configuracion documentados,
- migraciones o pasos manuales identificados.

### 2. Pull Request

El PR debe incluir:

- resumen tecnico claro,
- impacto en despliegue si existe,
- cambios de variables de entorno si aplica,
- pasos de validacion ejecutados.

El workflow `CI` debe quedar verde antes del merge.

### 3. Merge a `main`

Al mergear a `main` ocurre automaticamente:

1. GitHub Actions ejecuta `CI`.
2. Si `CI` pasa, workflow `Deploy`:
   - hace login en GHCR,
   - construye imagen con `Dockerfile.prod`,
   - publica tags:
     - `main`
     - `latest`
     - `sha-<commit>`
3. GitHub Actions llama `DOKPLOY_WEBHOOK_URL`.
4. Dokploy hace pull de imagen nueva y redepliega servicio.

## Verificacion post-deploy

### 1. Verificar GitHub Actions

Confirmar en GitHub:

- workflow `CI` exitoso,
- workflow `Deploy` exitoso,
- imagen visible en GHCR con tag esperado.

### 2. Verificar Dokploy

Confirmar en Dokploy:

- nuevo deploy completado,
- contenedor `brain-app` healthy,
- Neo4j healthy,
- sin restart loop,
- logs sin errores de bootstrap, auth o conexion a modelo.

### 3. Smoke checks HTTP

#### Health

```bash
curl https://brain.tudominio.com/health
```

Esperado:

- `status: ok` o al menos sin fallo critico,
- `services.neo4j.status = up`.

#### Ingesta

```bash
curl -X POST https://brain.tudominio.com/documents/text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"title":"Prod smoke","rawText":"Documento de prueba de produccion."}'
```

Esperado:

- respuesta `201`,
- `documentId` presente,
- `status` final `READY`.

#### Query

```bash
curl -X POST https://brain.tudominio.com/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"query":"¿Que dice el documento de prueba de produccion?"}'
```

Esperado:

- respuesta `200`,
- answer generado,
- sources o contexto presentes cuando aplique.

## Validaciones extra para cambios de ingesta

Si el release toca idempotencia, persistence o sync documental:

- repetir dos veces misma ingesta en mismo scope,
- verificar mismo `documentId`,
- repetir misma ingesta en distinto `libraryId`,
- verificar `documentId` distinto.

## Rollback

Si el deploy falla o rompe produccion:

### Opcion 1. Rollback por imagen fija

En Dokploy, cambiar:

```env
BRAIN_IMAGE=ghcr.io/orinocostudios/pinky:sha-<commit-anterior>
```

Luego redeplegar servicio.

### Opcion 2. Re-disparar version estable previa

Si ya existe un tag SHA validado en GHCR, usar ese tag como version estable temporal.

### Opcion 3. Desactivar cambio de configuracion

Si problema viene de env vars o proveedor LLM:

- restaurar valor anterior en Dokploy,
- redeplegar,
- revisar logs antes de reintentar release.

## Casos que requieren ventana controlada

Usar ventana controlada si release incluye:

- cambios de constraint o migraciones Neo4j,
- cambios de auth,
- cambios de dominio/certificados,
- cambios de proveedor LLM o infraestructura externa.

En esos casos, ejecutar:

1. backup de volumenes criticos,
2. checklist de rollback previo,
3. smoke checks inmediatos tras deploy.

## Checklist de release

- tests locales ejecutados
- CI verde
- Deploy verde
- imagen nueva visible en GHCR
- Dokploy healthy
- `/health` OK
- smoke ingest OK
- smoke query OK
- logs limpios
- rollback path identificado

## Referencias

- [Deploy Dokploy](./DEPLOY_DOKPLOY.md)
- [GitHub Registry](./GITHUB_REGISTRY.md)
- [Execution Plan](./EXECUTION_PLAN.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)
