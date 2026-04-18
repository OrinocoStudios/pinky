# Configuración de GitHub Container Registry (GHCR)

Guía para configurar el repositorio y GHCR para el pipeline de CI/CD de Brain Service.

## 1. Habilitar GitHub Actions en el repositorio

1. Ir a **Settings → Actions → General**.
2. En **Actions permissions**, seleccionar **Allow all actions and reusable workflows**.
3. En **Workflow permissions** (más abajo en la misma página):
   - Seleccionar **Read and write permissions**.
   - Marcar **Allow GitHub Actions to create and approve pull requests** (opcional).
4. Click en **Save**.

> Esto permite que el workflow publique imágenes en GHCR usando el `GITHUB_TOKEN` automático.

## 2. Verificar visibilidad del paquete en GHCR

Tras el primer push exitoso a `main`, la imagen se publica en GHCR. Para verificar:

1. Ir a la página principal del repositorio en GitHub.
2. En la barra lateral derecha, aparecerá la sección **Packages** con `pinky`.
3. Click en el paquete para ver las versiones disponibles.

Si no aparece, ir a `https://github.com/orgs/OrinocoStudios/packages` (o `https://github.com/<usuario>/packages` si es cuenta personal).

### Cambiar visibilidad del paquete

Por defecto, los paquetes heredan la visibilidad del repositorio. Para cambiarla:

1. Ir al paquete en **Packages → pinky**.
2. Click en **Package settings** (esquina derecha).
3. En **Danger Zone → Change package visibility**, seleccionar Public o Private según necesidad.

## 3. Configurar acceso para Dokploy (repositorio privado)

Si el repositorio es **privado**, Dokploy necesita un token para descargar la imagen. Si es **público**, este paso no es necesario.

### Crear un Personal Access Token (PAT)

1. Ir a **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click en **Generate new token (classic)**.
3. Configurar:
   - **Note**: `dokploy-ghcr-read`
   - **Expiration**: sin expiración (o la política que prefieras)
   - **Scopes**: marcar únicamente `read:packages`
4. Click en **Generate token**.
5. Copiar el token generado (no se puede volver a ver).

### Configurar credenciales en Dokploy

1. En Dokploy, ir a **Settings → Registry** (o en el servicio → **Registry**).
2. Añadir un nuevo registry:
   - **Registry URL**: `ghcr.io`
   - **Username**: tu usuario de GitHub (ej: `dcabrerar`)
   - **Password**: el PAT creado en el paso anterior
3. Guardar.

Ahora Dokploy puede hacer pull de `ghcr.io/orinocostudios/pinky:latest`.

## 4. Conectar permisos del repositorio al paquete

GitHub puede restringir qué repositorios acceden al paquete. Para vincularlos:

1. Ir a **Packages → pinky → Package settings**.
2. En **Manage Actions access**, click en **Add Repository**.
3. Buscar y añadir `pinky`.
4. Asignar el role **Write** para que el workflow pueda publicar.

> Normalmente esto se configura automáticamente en el primer push, pero si el workflow falla con `403 Forbidden`, revisar este paso.

## 5. Verificación desde línea de comandos

### Login en GHCR

```bash
echo $GHCR_TOKEN | docker login ghcr.io -u <usuario> --password-stdin
```

Donde `GHCR_TOKEN` es tu PAT con scope `read:packages` (o `write:packages` si necesitas push manual).

### Pull de la imagen

```bash
docker pull ghcr.io/orinocostudios/pinky:latest
```

### Listar tags disponibles

```bash
docker manifest inspect ghcr.io/orinocostudios/pinky:latest
```

## 6. Tags disponibles

El pipeline de deploy genera tres tags por cada push exitoso a `main`:

- **`main`** — Tag estable para producción continua.
- **`latest`** — Alias opcional del último build exitoso de `main`.
- **`sha-<commit>`** — SHA corto del commit (ej: `sha-a1b2c3d`). Útil para rollbacks o pinear una versión.

Para usar un tag específico en Dokploy, configurar la variable de entorno:

```env
BRAIN_IMAGE=ghcr.io/orinocostudios/pinky:sha-a1b2c3d
```

## 7. Troubleshooting

### El workflow falla con `denied: permission_denied`

- Verificar que **Workflow permissions** esté en **Read and write** (Paso 1).
- Verificar que el paquete tenga el repositorio vinculado con role **Write** (Paso 4).

### Dokploy no puede hacer pull de la imagen

- Verificar que el registry esté configurado en Dokploy con las credenciales correctas (Paso 3).
- Si el paquete es público, no se necesitan credenciales.
- Verificar que el PAT no haya expirado.

### La imagen no aparece en Packages

- Verificar que el workflow CI pasó correctamente (es prerrequisito del workflow `Deploy`).
- Revisar los logs del workflow `Deploy` en la pestaña **Actions** del repositorio.
- El workflow de deploy solo se ejecuta en pushes a `main`, no en PRs.

## 8. Secrets esperados por GitHub Actions

- `DOKPLOY_WEBHOOK_URL`: webhook o endpoint HTTP que dispara el redeploy en Dokploy.

`GITHUB_TOKEN` se usa automáticamente para publicar en GHCR, siempre que el repositorio tenga permisos `Read and write` para workflows.
