# ADR-0007: Hardening operacional para seguridad, confiabilidad e idempotencia

- **Estado**: Accepted
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

El servicio ya contaba con pipeline funcional de ingesta y query GraphRAG, pero presentaba riesgos operativos para producción:

1. Riesgo de reprocesamiento duplicado del outbox en despliegues con múltiples instancias.
2. Ausencia de límites de tráfico homogéneos por endpoint y globales.
3. Manejo de errores HTTP no estandarizado para clientes.
4. Observabilidad insuficiente para volumen, errores y latencia.
5. Riesgo de duplicación de documentos ante reintentos o requests concurrentes.

## Decisión

Adoptar un paquete de hardening transversal con cinco decisiones concretas:

1. **Outbox concurrente y confiable**  
   Reclamar eventos con operación atómica (`findOneAndUpdate`) con filtro estricto (`status in PENDING/FAILED`, `attempts < 10`) y transición a `PROCESSING` antes de ejecutar sync.

2. **Manejo global de errores HTTP**  
   Estandarizar respuestas de error con `HttpExceptionFilter` global: `statusCode`, `message`, `error`, `timestamp`, `path`.

3. **Rate limiting global y por endpoint**  
   Configurar `@nestjs/throttler` vía `ConfigService` con perfiles `default`, `query` y `upload` para proteger disponibilidad y costos LLM.

4. **Observabilidad mínima obligatoria**  
   Integrar logging estructurado JSON y métricas Prometheus (`brain_documents_ingested_total`, `brain_queries_total`, `brain_query_errors_total`, `brain_query_latency_ms`).

5. **Idempotencia de ingesta por checksum**  
   Calcular SHA-256 de `rawText`, buscar documento existente por checksum y retornar existente si aplica.  
   Reforzar con índice único de `checksum` en Mongo (`unique + sparse`) y fallback por `E11000` para condiciones de carrera.

## Consecuencias

### Positivas

- Menor probabilidad de doble procesamiento de eventos de outbox.
- Respuestas de error estables y trazables para consumidores de API.
- Protección operativa ante abuso y picos de carga.
- Visibilidad base para SRE/operación (volumen, errores, latencia).
- Ingesta idempotente en modo secuencial y concurrente.

### Negativas

- Mayor complejidad operativa (más estado y configuración por entorno).
- Riesgo de throttling agresivo si los límites iniciales no se calibran.
- Costo de mantenimiento de métricas y dashboards asociados.

## Alternativas consideradas

1. **No endurecer outbox y confiar en retry simple**  
   Descartado por riesgo de duplicados en despliegues multi-instancia.

2. **Idempotencia solo en capa aplicación (sin índice único)**  
   Descartado porque no cubre carreras concurrentes entre réplicas.

3. **Rate limiting solo en API Gateway externo**  
   Descartado para esta fase: se requiere protección embebida en servicio para entornos sin gateway.

4. **Logs sin estructura JSON**  
   Descartado por baja capacidad de consulta, agregación y correlación.

## Referencias

- [EXECUTION_PLAN.md](../EXECUTION_PLAN.md) - Fase 3
- [fase-3-hardening-operacional.md](../Fases/fase-3-hardening-operacional.md)
- [ADR-0003-ingestion-outbox-consistency.md](./ADR-0003-ingestion-outbox-consistency.md)
