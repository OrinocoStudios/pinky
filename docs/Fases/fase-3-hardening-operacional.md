# Fase 3 - Hardening Operacional

**Proyecto**: Brain Service  
**Fecha**: 2026-02-24  
**Fase**: 3 de 5  
**Estado**: Completado

---

## Objetivo

Preparar el Brain Service para ejecución sostenida en producción por dominio, implementando:
- Autenticación y autorización básica
- Límites de carga y rate limiting
- Observabilidad mínima (logs estructurados + métricas)
- Idempotencia en ingesta documental

## Estado Actual

### Completado en Fases Anteriores

**Fase 1** (✅ Completada):
- Embeddings y extracción de entidades con proveedores reales (Ollama por defecto).
- Búsqueda híbrida en MongoDB con scoring vector+texto.

**Fase 2** (✅ Completada):
- Proveedores LLM reales (OpenAI, Anthropic, Local)
- Sistema de citación de fuentes
- Prompts estructurados con control de alucinaciones
- Metadata de respuesta (modelo, tokens, fuentes citadas)

### Mejoras y decisiones residuales

- CORS no está habilitado por defecto (necesario solo si hay consumidores web directos).
- `LLM_PROVIDER=local` es útil para desarrollo/debug, pero no es la opción recomendada en producción.
- Aislamiento multi-proyecto en un solo deployment requiere diseño multi-tenant (hoy se recomienda “una instancia por dominio/proyecto”).

## Componentes a Implementar

### 1. Autenticación por API Key

#### 1.1. API Key Guard
**Ubicación**: `src/common/guards/api-key.guard.ts`

**Responsabilidades**:
- Validar header `X-API-Key` en requests
- Comparar contra `API_KEY` configurado en `.env`
- Rechazar requests sin key válida (401 Unauthorized)
- Logging de intentos fallidos

**Implementación**:
```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const validKey = this.configService.get('app.apiKey');
    
    if (!apiKey || apiKey !== validKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    
    return true;
  }
}
```

#### 1.2. Decorador de Protección
**Ubicación**: `src/common/decorators/require-api-key.decorator.ts`

```typescript
export const RequireApiKey = () => UseGuards(ApiKeyGuard);
```

#### 1.3. Aplicación Selectiva
Proteger rutas sensibles:
- `POST /documents/text` ✅
- `POST /documents/upload` ✅
- `POST /query` ✅
- `POST /outbox/retry` ✅
- `DELETE /documents/:id` ✅ (Fase 4)

Dejar públicas:
- `GET /health` - Para health checks
- Potencialmente `GET /documents` (read-only, opcional)

### 2. Límites de Carga

#### 2.1. File Upload Limits
**Ubicación**: `src/modules/documents/presentation/documents.controller.ts`

**Configuración**:
```typescript
@Post('upload')
@UseInterceptors(
  FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB por defecto
    },
    fileFilter: (req, file, callback) => {
      const allowedMimes = [
        'text/plain',
        'text/markdown', 
        'application/json',
        'text/csv',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(new BadRequestException('File type not allowed'), false);
      }
    },
  }),
)
```

**Variables de entorno**:
```env
MAX_FILE_SIZE_MB=10
ALLOWED_MIME_TYPES=text/plain,text/markdown,application/json,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

#### 2.2. Rate Limiting
**Dependencia**: `@nestjs/throttler`

**Configuración global**:
```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000,  // 60 segundos
  limit: 10,   // 10 requests por ventana
}])
```

**Configuración por endpoint**:
```typescript
@Throttle({ default: { ttl: 60000, limit: 5 } })
@Post('query')
async query(@Body() body: QueryDto) { ... }
```

**Variables de entorno**:
```env
RATE_LIMIT_TTL=60000
RATE_LIMIT_GLOBAL=10
RATE_LIMIT_QUERY=5
RATE_LIMIT_UPLOAD=3
```

#### 2.3. Request Body Size
**Configuración en main.ts**:
```typescript
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
```

### 3. Observabilidad Mínima

#### 3.1. Logging Estructurado

**Servicio Logger**:
`src/common/logger/structured-logger.service.ts`

```typescript
@Injectable()
export class StructuredLogger {
  log(context: string, message: string, meta?: Record<string, any>) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      context,
      message,
      ...meta,
    }));
  }

  error(context: string, error: Error, meta?: Record<string, any>) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      context,
      message: error.message,
      stack: error.stack,
      ...meta,
    }));
  }
}
```

**Formato de logs**:
```json
{
  "timestamp": "2026-02-24T21:30:00.000Z",
  "level": "info",
  "context": "QueryController",
  "message": "Query completed",
  "query": "¿Qué es...?",
  "model": "gpt-4o-mini",
  "tokens": 450,
  "latency_ms": 1200,
  "sources_cited": 3
}
```

#### 3.2. Métricas Básicas

**Endpoint de métricas**:
`GET /metrics` - Formato Prometheus

**Métricas a exponer**:
```
# Ingesta
brain_documents_ingested_total{status="success|error"}
brain_documents_processing_duration_seconds

# Queries
brain_queries_total{provider="openai|anthropic|local"}
brain_query_duration_seconds
brain_query_tokens_total{provider="openai|anthropic"}
brain_query_sources_cited

# Outbox
brain_outbox_events_total{status="pending|synced|failed"}
brain_outbox_retry_attempts_total

# System
brain_http_requests_total{method,path,status}
brain_http_request_duration_seconds{method,path}
```

**Dependencia**: `@willsoto/nestjs-prometheus`

**Configuración**:
```typescript
PrometheusModule.register({
  path: '/metrics',
  defaultMetrics: {
    enabled: true,
  },
})
```

#### 3.3. Health Check Mejorado

**Endpoint mejorado**: `GET /health`

**Respuesta extendida**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-24T21:30:00.000Z",
  "uptime": 3600,
  "services": {
    "mongodb": {
      "status": "up",
      "latency_ms": 5
    },
    "neo4j": {
      "status": "up",
      "latency_ms": 8
    },
    "llm": {
      "provider": "openai",
      "status": "configured"
    }
  },
  "version": "0.2.0"
}
```

**Dependencia**: `@nestjs/terminus`

### 4. Idempotencia en Ingesta

#### 4.1. Cálculo de Checksum

**Servicio**: `src/common/utils/checksum.service.ts`

```typescript
@Injectable()
export class ChecksumService {
  calculate(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }
}
```

#### 4.2. Control de Duplicados

**Flujo en IngestDocumentUseCase**:
1. Calcular checksum del texto crudo
2. Buscar documento existente por checksum
3. Si existe:
   - Retornar documento existente
   - Log: "Document already exists (checksum match)"
4. Si no existe:
   - Proceder con ingesta normal
   - Guardar checksum en documento

**Campo en modelo**:
```typescript
export interface DocumentRecord {
  documentId: string;
  checksum: string;  // SHA-256 del rawText
  // ... resto de campos
}
```

#### 4.3. Cabecera de Idempotencia (Opcional)

**Header**: `Idempotency-Key`

Si se proporciona, guardar en metadata del documento:
```typescript
metadata: {
  idempotencyKey: req.headers['idempotency-key'],
  // ...
}
```

### 5. Exception Filters Globales

**Ubicación**: `src/common/filters/http-exception.filter.ts`

**Responsabilidades**:
- Capturar todas las excepciones HTTP
- Formatear respuestas de error consistentes
- Logging estructurado de errores
- No exponer detalles internos en producción

**Formato de respuesta**:
```json
{
  "statusCode": 400,
  "message": "Invalid input",
  "error": "Bad Request",
  "timestamp": "2026-02-24T21:30:00.000Z",
  "path": "/documents/upload"
}
```

### 6. Validation Pipes

**Configuración global**:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,       // Remover props no declaradas
    forbidNonWhitelisted: true,  // Error si hay props extra
    transform: true,       // Transformar a tipos DTO
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

## Plan de Implementación

### Paso 1: Autenticación API Key
- Crear `ApiKeyGuard`
- Crear decorador `@RequireApiKey()`
- Aplicar guard a endpoints sensibles
- Tests de autenticación

### Paso 2: Límites de Carga
- Configurar file upload limits
- Instalar y configurar `@nestjs/throttler`
- Aplicar rate limiting por endpoint
- Configurar body size limits
- Tests de límites

### Paso 3: Logging Estructurado
- Crear `StructuredLogger` service
- Integrar en controllers y use cases
- Definir formato JSON consistente
- Tests de logging

### Paso 4: Métricas
- Instalar `@nestjs/prometheus`
- Definir métricas custom
- Exponer endpoint `/metrics`
- Tests de métricas

### Paso 5: Health Check Mejorado
- Instalar `@nestjs/terminus`
- Implementar health indicators (MongoDB, Neo4j)
- Endpoint `/health` con detalles
- Tests de health check

### Paso 6: Idempotencia
- Crear `ChecksumService`
- Integrar en `IngestDocumentUseCase`
- Control de duplicados por checksum
- Tests de idempotencia

### Paso 7: Exception Handling
- Crear `HttpExceptionFilter`
- Aplicar globally
- Tests de manejo de errores

### Paso 8: Validation
- Configurar `ValidationPipe` globally
- Revisar todos los DTOs
- Tests de validación

### Paso 9: Documentación
- Actualizar `CHANGELOG.md`
- Crear ADR-0006 para decisiones de seguridad
- Actualizar README con autenticación
- Documentar métricas disponibles

### Paso 10: Testing E2E
- Tests de autenticación
- Tests de rate limiting
- Tests de idempotencia
- Tests de health check

## Variables de Entorno Nuevas

```env
# Security
API_KEY=your-secret-api-key-here
ENABLE_API_KEY_AUTH=true

# Rate Limiting
RATE_LIMIT_TTL=60000
RATE_LIMIT_GLOBAL=10
RATE_LIMIT_QUERY=5
RATE_LIMIT_UPLOAD=3
RATE_LIMIT_INGEST=5

# Upload Limits
MAX_FILE_SIZE_MB=10
ALLOWED_MIME_TYPES=text/plain,text/markdown,application/json,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# Observability
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PATH=/metrics

# Idempotency
ENABLE_CHECKSUM_VALIDATION=true
```

## Dependencias Nuevas

```json
{
  "dependencies": {
    "@nestjs/throttler": "^5.0.0",
    "@nestjs/terminus": "^10.0.0",
    "@willsoto/nestjs-prometheus": "^6.0.0",
    "prom-client": "^15.0.0"
  }
}
```

## Criterios de Éxito

✅ Servicio protegido por API key en rutas sensibles  
✅ Rate limiting funcional (10 req/min global, 5 req/min en query)  
✅ Uploads limitados a 10MB y tipos MIME permitidos  
✅ Logs estructurados en formato JSON  
✅ Métricas expuestas en `/metrics` (formato Prometheus)  
✅ Health check detallado con estado de servicios  
✅ Idempotencia en ingesta (checksum SHA-256)  
✅ Exception handling global con respuestas consistentes  
✅ Validación global de DTOs  
✅ Documentación actualizada (CHANGELOG, ADR, README)  
✅ Tests E2E de seguridad y límites

## Riesgos y Mitigaciones

### Riesgo: API Key en texto plano
**Mitigación**: 
- Documentar uso de secrets management en producción
- Variable `API_KEY` nunca en repositorio
- Considerar JWT para Fase 4

### Riesgo: Rate limiting muy restrictivo
**Mitigación**:
- Valores configurables por entorno
- Monitorear métricas de requests rechazados
- Ajustar según uso real

### Riesgo: Overhead de logging
**Mitigación**:
- Logs asíncronos (no bloquean request)
- Nivel de log configurable
- Sampling en producción si es necesario

### Riesgo: Checksum no detecta cambios menores
**Mitigación**:
- Checksum es de contenido completo (sensible a cualquier cambio)
- Idempotency-Key header como alternativa
- Documentar comportamiento

## Notas de Implementación

- Usar guards y filters de NestJS (no middlewares personalizados)
- Logging debe ser asíncrono para no afectar latencia
- Métricas deben ser ligeras (no afectar performance)
- API key actual es básico, considerar JWT/OAuth en futuras fases
- Health check debe fallar rápido (timeout corto)
- Tests deben cubrir casos de abuso (muchos requests, files grandes)

## Referencias

- NestJS Guards: https://docs.nestjs.com/guards
- NestJS Throttler: https://docs.nestjs.com/security/rate-limiting
- Prometheus Metrics: https://prometheus.io/docs/concepts/metric_types/
- NestJS Terminus: https://docs.nestjs.com/recipes/terminus

## Siguiente Fase

**Fase 4**: Administración de corpus e índice
- `DELETE /documents/:id`
- `POST /index/rebuild`
- `POST /documents/generate`
