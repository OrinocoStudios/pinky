# Despliegue en Dokploy — Brain Service

## Requisitos previos

- VPS con Dokploy instalado (mínimo 4GB RAM, recomendado 8GB+)
- Dominio/subdominio apuntando al VPS (registro A en DNS)
- Repositorio del proyecto accesible desde el VPS (GitHub)

## Arquitectura de despliegue

El despliegue se divide en **dos servicios Compose independientes**:

1. **brain-service** (`docker-compose.prod.yml`): API NestJS + Neo4j
2. **ollama** (`docker-compose.ollama.yml`): Servidor de modelos LLM (embeddings + extracción)

La imagen de `brain-service` se construye y publica automáticamente en **GitHub Container Registry** (GHCR) mediante GitHub Actions. El flujo es:

1. Push a `main` → CI (build + tests)
2. CI pasa → Docker workflow construye y publica `ghcr.io/orinocostudios/pinky:latest`
3. Dokploy hace pull de la imagen publicada

Ollama se separa para poder moverlo a un servidor con GPU en el futuro sin cambiar nada en la app — solo cambiando `OLLAMA_BASE_URL`.

---

## Paso 1: Desplegar Ollama

1. En Dokploy, crear un **nuevo proyecto** (ej: `brain-platform`).
2. Dentro del proyecto, crear un servicio **Compose**.
3. Conectar el repositorio Git y seleccionar la rama `main`.
4. En **Compose Path**, escribir: `docker-compose.ollama.yml`
5. Click en **Save** y luego **Deploy**.
6. Una vez desplegado, abrir la terminal del contenedor `ollama` desde Dokploy y ejecutar:

```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

7. Verificar que los modelos estén listos:

```bash
ollama list
```

> **Nota**: La descarga de modelos puede tomar varios minutos (~2.3GB total). Solo es necesario hacerlo una vez — los modelos persisten en el volumen `ollama-models`.

---

## Paso 2: Desplegar Brain Service

1. En el mismo proyecto, crear **otro servicio Compose**.
2. Conectar el mismo repositorio Git, rama `main`.
3. En **Compose Path**, escribir: `docker-compose.prod.yml`
4. Si el repositorio es privado, configurar las credenciales de GHCR en Dokploy:
   - **Registry URL**: `ghcr.io`
   - **Username**: tu usuario de GitHub
   - **Password**: un Personal Access Token (PAT) con scope `read:packages`
5. Ir a la pestaña **Environment** y configurar las variables (ver sección abajo).
6. Click en **Save** y luego **Deploy**.

El compose usa `image: ghcr.io/orinocostudios/pinky:latest` por defecto. Se puede cambiar con la variable `BRAIN_IMAGE` para apuntar a un tag específico (ej: un SHA de commit).

El servicio esperará a que Neo4j pase su healthcheck antes de arrancar.

---

## Paso 3: Configurar variables de entorno

En la pestaña **Environment** del servicio brain-service en Dokploy, configurar como mínimo:

```env
# OBLIGATORIAS (cambiar estos valores)
API_KEY=tu-api-key-segura-aqui
NEO4J_PASSWORD=tu-password-neo4j-aqui

# OLLAMA (ajustar según despliegue)
# Si Ollama corre en el mismo VPS (docker-compose.ollama.yml):
OLLAMA_BASE_URL=http://host.docker.internal:11434
# Si Ollama corre en un servidor externo:
# OLLAMA_BASE_URL=http://<ip-servidor-gpu>:11434

# LLM PROVIDER (por defecto usa modo local sin API keys)
LLM_PROVIDER=local
# Para respuestas reales con OpenAI:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# Para respuestas reales con Anthropic:
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...
```

El archivo `.env.production` en el repositorio contiene todas las variables disponibles con sus valores por defecto.

---

## Paso 4: Configurar dominio

1. En Dokploy, ir al servicio `brain-service` → pestaña **Domains**.
2. En **Service Name**, seleccionar `brain-app` (el servicio NestJS).
3. Configurar:
   - **Domain**: `brain.tudominio.com` (o el subdominio que prefieras)
   - **Port**: `8081`
   - **HTTPS**: activar (Let's Encrypt)
4. Click en **Save**.
5. Esperar ~30 segundos para que Traefik genere el certificado SSL.

---

## Verificación post-despliegue

### Health check

```bash
curl https://brain.tudominio.com/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "services": {
    "neo4j": { "status": "up" },
    "llm": { "provider": "local", "status": "configured" }
  }
}
```

### Ingestar un documento de prueba

```bash
curl -X POST https://brain.tudominio.com/documents/text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key-segura-aqui" \
  -d '{"title":"Test","rawText":"Este es un documento de prueba para verificar que el pipeline funciona correctamente."}'
```

### Consultar

```bash
curl -X POST https://brain.tudominio.com/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key-segura-aqui" \
  -d '{"query":"¿Qué dice el documento de prueba?"}'
```

---

## Notas operativas

### Ollama en servidor externo (GPU)

Cuando tengas un servidor con GPU disponible:

1. Instalar Ollama en el servidor GPU: `curl -fsSL https://ollama.com/install.sh | sh`
2. Descargar modelos: `ollama pull nomic-embed-text && ollama pull llama3.2`
3. Configurar Ollama para escuchar en todas las interfaces: `OLLAMA_HOST=0.0.0.0 ollama serve`
4. En Dokploy, cambiar la variable `OLLAMA_BASE_URL=http://<ip-servidor-gpu>:11434`
5. Redesplegar el servicio brain-service.

### Backups

Dokploy soporta backups automáticos de named volumes. Los volúmenes a respaldar son:
- `brain-neo4j-data` (documentos, chunks, grafo y chat history)
- `brain-objects` (archivos crudos)

### Métricas

Prometheus metrics disponibles en `GET /metrics` (ruta interna, no expuesta por defecto). Para monitoreo, conectar Grafana apuntando al puerto 8081 del contenedor `brain-app`.

### Logs

Los logs del servicio son JSON estructurado. Se pueden ver directamente en la UI de Dokploy en la pestaña **Logs** del servicio.

### Actualizar

El flujo de actualización es automático:
1. Push a `main` → GitHub Actions ejecuta CI (build + tests).
2. Si CI pasa → se construye y publica la nueva imagen en GHCR.
3. En Dokploy, click en **Deploy** en el servicio brain-service (hace pull de la imagen nueva).

Opcionalmente, se puede configurar un **webhook** en Dokploy para que el deploy sea totalmente automático tras cada push exitoso.

Para pinear una versión específica, configurar `BRAIN_IMAGE=ghcr.io/orinocostudios/pinky:<sha>` en las variables de entorno.
