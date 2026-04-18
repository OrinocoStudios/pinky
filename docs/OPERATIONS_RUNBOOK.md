# Pinky — Operations Runbook

Guía práctica para tareas operativas del MVP en producción: rotación de secretos, backups/restore de datos y rollback rápido.

Aplica al despliegue en Dokploy con:

- Backend en `brain.tudominio.com` (servicio Compose `brain-service` desde `docker-compose.prod.yml`).
- Frontend en `app.tudominio.com` (servicio Compose `web` desde `docker-compose.web.yml`).
- Ollama / endpoint OpenAI-compatible propio referenciado por `OPENAI_BASE_URL` / `OLLAMA_BASE_URL`.

## Variables críticas (obligatorias en producción)

El arranque del backend falla si estas quedan con su valor por defecto (`NODE_ENV=production`):

| Variable | Obligatoria cuando | Notas |
| :--- | :--- | :--- |
| `API_KEY` | `ENABLE_API_KEY_AUTH=true` | Valor fuerte, nunca `change-me-in-production` |
| `AUTH_JWT_SECRET` | siempre | Mínimo 32 bytes aleatorios |
| `NEO4J_PASSWORD` | siempre | Nunca `neo4j_password` |
| `AUTH_COOKIE_SECURE` | `AUTH_COOKIE_SAME_SITE=none` | Debe ser `true` |

Validadas en [pinky/src/config/configuration.ts](../src/config/configuration.ts) por `validateProductionConfig`.

## 1. Rotación de secretos

### 1.1 `API_KEY`

**Impacto**: todos los clientes que usan `X-API-Key` dejan de autenticar hasta actualizar.

Pasos:

1. Generar nuevo valor: `openssl rand -hex 32`.
2. En Dokploy → servicio `brain-service` → **Environment**, actualizar `API_KEY`.
3. Dokploy redepliega. El contenedor nuevo usa el valor nuevo; el anterior deja de responder al cerrar.
4. Actualizar el valor en todos los consumidores (Pinky MCP, integraciones internas, tests manuales).
5. Validar con:
   ```bash
   curl -fsSL -H "X-API-Key: $NEW_API_KEY" https://brain.tudominio.com/documents | jq .
   ```

### 1.2 `AUTH_JWT_SECRET`

**Impacto**: todas las sesiones activas se invalidan (todos los usuarios deben volver a loguearse).

Pasos:

1. Generar nuevo secreto: `openssl rand -base64 48`.
2. En Dokploy → `brain-service` → Environment, actualizar `AUTH_JWT_SECRET`.
3. Redeploy.
4. Comprobar `GET /auth/me` con una cookie anterior → debe devolver `401`.
5. Login nuevo y verificar `GET /auth/me` → `200`.

### 1.3 `NEO4J_PASSWORD`

**Impacto**: requiere cambio coordinado en la base de datos antes de redeploy del backend.

Pasos:

1. Abrir shell del contenedor `neo4j` en Dokploy.
2. Conectar con `cypher-shell -u neo4j -p <password-actual>` y ejecutar:
   ```cypher
   ALTER USER neo4j SET PASSWORD '<password-nuevo>';
   ```
3. Actualizar `NEO4J_PASSWORD` en Dokploy (servicio `brain-service`).
4. Redeploy del backend.
5. `GET /health` debe reportar `services.neo4j.status=up`.

### 1.4 `OPENAI_API_KEY` / `OLLAMA_API_KEY`

**Impacto**: ingest y query con proveedores OpenAI-compatible dejan de funcionar hasta redeploy.

Pasos:

1. Generar la clave nueva en el proveedor.
2. Actualizar en Dokploy → `brain-service` → Environment.
3. Redeploy.
4. `curl https://brain.tudominio.com/health` → `services.llm.status=up`.
5. Smoke ingest + smoke query como en [PRODUCTION_RELEASE.md](./PRODUCTION_RELEASE.md).

## 2. Backup y restore

Volúmenes críticos (definidos en [docker-compose.prod.yml](../docker-compose.prod.yml)):

- `brain-neo4j-data` — toda la persistencia: documentos, chunks, embeddings, grafo, chat history.
- `brain-objects` — archivos crudos de los documentos subidos.

### 2.1 Backup manual (Neo4j lógico)

1. Abrir shell del contenedor `neo4j`.
2. Crear dump en caliente:
   ```bash
   neo4j-admin database dump neo4j --to-path=/backups
   ```
3. Copiar el archivo al host:
   ```bash
   docker cp brain-service-neo4j-1:/backups/neo4j.dump ./backups/neo4j-$(date -u +%Y%m%dT%H%M%SZ).dump
   ```
4. Sincronizar el archivo a almacenamiento fuera del VPS (S3/B2/rsync).

### 2.2 Backup de volúmenes Docker (alternativa)

Desde el host del VPS:

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker run --rm \
  -v brain-service_brain-neo4j-data:/data:ro \
  -v "$PWD/backups":/backup \
  alpine tar -czf "/backup/neo4j-data-${STAMP}.tar.gz" -C /data .

docker run --rm \
  -v brain-service_brain-objects:/data:ro \
  -v "$PWD/backups":/backup \
  alpine tar -czf "/backup/brain-objects-${STAMP}.tar.gz" -C /data .
```

### 2.3 Restore (volumen completo)

1. Parar `brain-service` en Dokploy (o `docker compose stop brain-app neo4j`).
2. Restaurar archivos:
   ```bash
   docker run --rm \
     -v brain-service_brain-neo4j-data:/data \
     -v "$PWD/backups":/backup \
     alpine sh -c "cd /data && tar -xzf /backup/neo4j-data-<stamp>.tar.gz"
   ```
3. Arrancar los servicios.
4. Validar `/health` y smoke query.

### 2.4 Política mínima recomendada

- Backup automático diario (Dokploy → volumen → schedule).
- Retención: 7 diarios, 4 semanales, 6 mensuales.
- Probar restore en entorno staging al menos **una vez por trimestre**.

## 3. Rollback

### 3.1 Rollback al SHA anterior de backend (preferido)

1. Identificar el SHA estable previo en GHCR (`ghcr.io/orinocostudios/pinky`).
2. En Dokploy → `brain-service` → Environment:
   ```
   BRAIN_IMAGE=ghcr.io/orinocostudios/pinky:sha-<commit-anterior>
   ```
3. Redeploy.
4. `/health` verde → el rollback ha dejado el servicio operativo.
5. Investigar el commit que rompió el deploy antes de volver a `:main`.

### 3.2 Rollback del frontend

1. Identificar el SHA anterior en GHCR (`ghcr.io/orinocostudios/pinky-web`).
2. En Dokploy → `web` → Environment:
   ```
   WEB_IMAGE=ghcr.io/orinocostudios/pinky-web:sha-<commit-anterior>
   ```
3. Redeploy.

### 3.3 Rollback de configuración

Si el problema no es de imagen sino de variables (p. ej. cookie cross-site mal configurada):

1. Restaurar el valor anterior en Dokploy.
2. Redeploy.
3. Abrir un PR con el ajuste correcto para el siguiente release.

### 3.4 Ensayo obligatorio

Antes del primer release de producción, ejecutar el rollback contra staging:

1. Desplegar un SHA conocido.
2. Cambiar `BRAIN_IMAGE` a un SHA previo.
3. Verificar que `/health` sigue verde y que no hay pérdida de datos.
4. Documentar la fecha del ensayo aquí (sección 4).

## 4. Historial de ensayos y cambios de configuración

| Fecha | Entorno | Acción | Responsable |
| :--- | :--- | :--- | :--- |
| _(pendiente)_ | staging | Rollback backend (primer ensayo) |  |
| _(pendiente)_ | staging | Restore Neo4j desde dump |  |

Actualizar esta tabla cada vez que se ejecute uno de estos procedimientos contra un entorno real.

## 5. Observabilidad mínima

- `GET /health` — estado de Neo4j y LLM (con ping real al endpoint OpenAI-compatible).
- `GET /metrics` — métricas Prometheus (`brain_documents_ingested_total`, `brain_queries_total`, `brain_query_errors_total`, `brain_query_latency_ms`).
- Logs JSON estructurado en stdout; eventos de dominio emitidos con `context=DomainEvent` y campo `event` (p. ej. `DocumentIngested`, `DocumentDeleted`, `IndexRebuilt`, `QueryExecuted`).

## Referencias

- [Deploy Dokploy](./DEPLOY_DOKPLOY.md)
- [Production Release](./PRODUCTION_RELEASE.md)
- [GitHub Registry](./GITHUB_REGISTRY.md)
