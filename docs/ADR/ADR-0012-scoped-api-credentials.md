# ADR-0012: Credenciales de API con ámbito (API key → tenant/librería)

- **Estado**: Accepted (implementado)
- **Fecha**: 2026-07-25
- **Contexto previo**: [ADR-0008](ADR-0008-multi-tenant-corpus-isolation.md), [ADR-0009](ADR-0009-library-scoping.md)

## Contexto

ADR-0008 dejó explícitamente pendiente el *"mapeo fuerte API key → tenant permitido"* y
eligió provisionalmente la estrategia menos segura de las dos que planteaba: **una API key
compartida en la que el cliente envía `X-Tenant-Id` y el backend se fía del header**.

Con esa configuración, compartir el servidor con otras personas no es viable. Cualquiera que
tuviese la key podía:

- leer y escribir en el corpus de cualquier tenant cambiando `X-Tenant-Id`;
- saltar entre librerías cambiando `X-Library-Id`, o pasando `libraryIds` en el body de
  `/query` y `/retrieve`;
- suplantar tenant por body en `/summarize` (`body.tenantId` tenía prioridad sobre el header);
- leer el historial de chat de cualquier sesión, porque `GET /query/history/:sessionId` no
  filtraba por tenant.

La comparación de la key además se hacía con `!==`, sensible a temporización.

## Decisión

Introducir **principals**: la credencial deja de ser un booleano ("¿es válida?") y pasa a
identificar *quién* llama y *sobre qué* puede actuar.

### Configuración

`API_KEYS` es un array JSON de credenciales con ámbito:

```json
[
  { "label": "acme",   "key": "<32+ chars>", "tenantId": "acme",   "libraries": ["mcp:acme:*"] },
  { "label": "globex", "key": "<32+ chars>", "tenantId": "globex", "libraries": ["mcp:globex:*"] }
]
```

- `tenantId` ausente ⇒ credencial **sin restricción** (comportamiento heredado).
- `libraries` admite id exacto, prefijo terminado en `*`, o `["*"]`.
- `API_KEY` (la clave única de siempre) sigue funcionando como credencial sin restricción,
  de modo que los despliegues existentes no requieren cambios.
- Una sesión admin autenticada por JWT es también un principal sin restricción.

### Regla de resolución

Los headers son una **petición**, no una autorización:

- si la credencial está fijada a un tenant, ese tenant se impone; un header que pida otro
  devuelve `403`;
- una credencial restringida solo alcanza sus librerías; cualquier otra devuelve `403`,
  tanto por header como por `libraryIds` del body;
- si la credencial posee exactamente una librería concreta, no hace falta enviar el header;
  si posee un prefijo, es obligatorio indicar cuál (si no, la escritura caería fuera de
  cualquier librería).

La comparación de claves pasa a ser de tiempo constante y recorre siempre todos los
candidatos.

## Consecuencias

### Positivas
- Se puede compartir una sola instancia de Pinky con terceros sin exponer el corpus ajeno.
- El aislamiento deja de depender de que el cliente se porte bien.
- Cierra el pendiente de ADR-0008 y la IDOR del historial de chat.

### Negativas / costos
- Rotar una clave implica editar `API_KEYS` y redesplegar; no hay aún gestión de
  credenciales en caliente ni revocación individual desde la UI.
- El *rate limiting* sigue siendo por IP, no por credencial: un tenant ruidoso puede
  consumir la cuota compartida. Pendiente si se abre a más consumidores.
