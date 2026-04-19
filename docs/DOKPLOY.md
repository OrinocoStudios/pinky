# Despliegue en Dokploy (Neo4j + Backend + Frontend)

Guía operativa para Pinky usando los ficheros ya presentes en este repositorio.

## Arquitectura recomendada

| Stack | Fichero | Contenido |
|--------|---------|-----------|
| Datos + API | [`docker-compose.prod.yml`](../docker-compose.prod.yml) | `neo4j` + `brain-app` |
| Frontend | [`docker-compose.web.yml`](../docker-compose.web.yml) | `web` (nginx + estáticos Vite) |

Ambos compose declaran la red externa **`dokploy-network`**. El backend se conecta a Neo4j por la red interna `brain-internal` (`NEO4J_URI=bolt://neo4j:7687`). El proxy de Dokploy debe publicar solo **API** y **web**, no Neo4j Bolt/HTTP salvo necesidad operativa.

## 1. Red Docker y registry GHCR

### Red `dokploy-network`

En el servidor (una vez):

```bash
cd pinky
chmod +x scripts/dokploy-init-network.sh
./scripts/dokploy-init-network.sh
```

Equivale a `docker network create dokploy-network` si no existe. Si Dokploy usa otro nombre de red unificada, crea esa red y sustituye el nombre en los compose o enlaza el proyecto al mismo bridge que el proxy.

### Imágenes privadas en GHCR

Si las imágenes `ghcr.io/orinocostudios/pinky` o `pinky-web` son privadas, configura en Dokploy un registry con usuario de GitHub y un PAT con scope `read:packages`. Detalle: [GITHUB_REGISTRY.md](GITHUB_REGISTRY.md).

## 2. Variables y secretos

Plantilla agrupada para copiar al panel de variables de Dokploy (o fichero `.env` del proyecto): [`.env.dokploy.example`](../.env.dokploy.example).

Revisa como mínimo:

- **Neo4j**: `NEO4J_USER`, `NEO4J_PASSWORD` (idénticos en servicio Neo4j y backend).
- **API**: `API_KEY`, proveedor LLM (`LLM_PROVIDER`, `OPENAI_*`, etc.).
- **Dominios**: `CORS_ORIGINS` = origen exacto del front (HTTPS).
- **OAuth**: `GOOGLE_CALLBACK_URL` / `GITHUB_CALLBACK_URL` apuntando al **dominio público del API**.
- **Cookies SPA en otro host**: `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none`, `AUTH_SUCCESS_URL` / `AUTH_FAILURE_URL` al front.

Referencia extendida: [`.env.example`](../.env.example).

## 3. Desplegar Neo4j + backend

1. En Dokploy, crea un proyecto **Docker Compose** apuntando al repositorio con **ruta de contexto** en la carpeta `pinky/` (raíz donde están `Dockerfile.prod` y `docker-compose.prod.yml`).
2. Archivo compose: **`docker-compose.prod.yml`**.
3. Carga variables desde `.env.dokploy.example` (ajustadas).
4. Asigna dominio público al servicio **`brain-app`** (puerto contenedor **8081**). Traefik/proxy debe enrutar HTTPS → `brain-app:8081`.
5. Tras el despliegue: `GET https://tu-api/health` debe responder OK (Neo4j up tras `depends_on` + healthcheck).

Persistencia: volúmenes `brain-neo4j-data` y `brain-objects` definidos en el compose.

## 4. Desplegar frontend

1. Segundo proyecto Compose (recomendado) con el mismo repo y contexto **`pinky/`**.
2. Archivo: **`docker-compose.web.yml`**.
3. **Imprescindible en build**: `VITE_API_BASE_URL=https://api.tudominio.com` (URL pública del backend). El Dockerfile de `web/` lee este `ARG` en tiempo de build; si omites el valor, el bundle puede seguir apuntando al entorno incorrecto.

   En Dokploy, define esta variable en el bloque de **build args / environment del build** del servicio `web`, o en un `.env` que Compose use al ejecutar `docker compose build`.

4. Dominio público para el servicio **`web`** (puerto contenedor **80** mapeado según `WEB_PORT`).
5. Imagen preconstruida: puedes fijar `WEB_IMAGE` o dejar que Compose construya desde `./web` con el `Dockerfile` del front (el compose incluye sección `build`).

## 5. TLS, OAuth y CORS (checklist manual)

Tras tener HTTPS en API y front:

1. En consolas Google/GitHub OAuth, registra las redirect URI exactas (`https://api…/auth/.../callback`).
2. Confirma que `CORS_ORIGINS` coincide carácter a carácter con el origen del navegador (esquema + host + puerto si no es 443).
3. Prueba login OAuth desde el front en producción; si fallan cookies, revisa `AUTH_COOKIE_*` y SameSite.

## 6. Smoke tests automatizables

Desde tu máquina (sustituye URLs):

```bash
cd pinky
chmod +x scripts/smoke-dokploy.sh
./scripts/smoke-dokploy.sh https://api.tudominio.com https://app.tudominio.com
```

Valida `GET /health` y carga básica del front.

## GitHub Actions (`release.yml`)

En **Actions → Release** (workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml)) ocurre:

1. **Tests** del backend (`npm test`, e2e) y del directorio `web/` en cada push a `main`.
2. **`publish-backend`**: build y push a `ghcr.io/<owner>/pinky` solo si cambian `src/**`, `Dockerfile.prod`, dependencias raíz, etc.
3. **`publish-web`**: push a `ghcr.io/<owner>/pinky-web` solo si cambian archivos bajo `web/**`.
4. **Webhooks** (POST) tras cada publicación exitosa:
   - **API + Neo4j**: secret `DOKPLOY_WEBHOOK_BACKEND` (o legacy `DOKPLOY_WEBHOOK_URL`).
   - **Frontend**: `DOKPLOY_WEBHOOK_WEB` (o legacy `DOKPLOY_WEB_WEBHOOK_URL`).
   - **Stack compose** (opcional): `DOKPLOY_WEBHOOK_STACK` cuando cambia `docker-compose.prod.yml` / `docker-compose.runtime.yml`, o manualmente en **Run workflow** con *trigger_stack_webhook*.

Secretos adicionales en GitHub: `VITE_API_BASE_URL` para compilar el bundle del front contra tu API pública. Detalle en [GITHUB_REGISTRY.md](GITHUB_REGISTRY.md) (sección «Secrets esperados por GitHub Actions»).

Los pushes a la rama `develop` siguen usando solo [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (sin publicar imágenes). Los PR ejecutan el mismo CI.

## 7. Operación y rollback

- **Redeploy tras CI**: el workflow **Release** llama a los webhooks configurados; sin secret, se omite con un aviso en el log.
- **Rollback**: cambia `BRAIN_IMAGE` / `WEB_IMAGE` a un tag por commit (`sha-…`) y vuelve a desplegar.
- **Backups**: plan para el volumen de Neo4j y para `brain-objects` (ficheros subidos).

## Resumen de ficheros añadidos o relevantes

| Ruta | Uso |
|------|-----|
| [`scripts/dokploy-init-network.sh`](../scripts/dokploy-init-network.sh) | Crear red Docker externa |
| [`scripts/smoke-dokploy.sh`](../scripts/smoke-dokploy.sh) | Smoke HTTP(s) API + front |
| [`.env.dokploy.example`](../.env.dokploy.example) | Plantilla de variables Dokploy |
