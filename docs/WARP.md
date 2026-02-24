# Brain Service - Contexto para Warp AI

## Descripción del Proyecto

Brain Service es un servicio API para ingesta documental y GraphRAG (Graph Retrieval-Augmented Generation) implementado con arquitectura hexagonal en NestJS. El servicio combina bases de datos vectoriales, grafos de conocimiento y búsqueda semántica para proporcionar respuestas contextualizadas basadas en documentos.

## Arquitectura

### Estructura Hexagonal

```
src/
├── domain/          # Modelos y puertos (sin dependencias externas)
├── application/     # Casos de uso y lógica de negocio
├── infrastructure/  # Adaptadores (mongo, neo4j, elasticsearch)
└── config/          # Configuración central de runtime
```

### Componentes Principales

- **MongoDB**: Almacenamiento de documentos, chunks y embeddings
- **Neo4j**: Grafo de conocimiento con entidades y relaciones
- **Search Engine**: Motor de búsqueda desacoplado (MongoDB por defecto, Elasticsearch opcional)

## Tecnologías

- **Framework**: NestJS 11.x
- **Runtime**: Node.js con TypeScript 5.6
- **Bases de datos**: 
  - MongoDB (mongoose 8.7)
  - Neo4j (neo4j-driver 5.26)
- **Procesamiento**: 
  - PDF (pdf-parse)
  - DOCX (mammoth)
  - Validación (class-validator, class-transformer)

## Pipelines

### Pipeline 1: Ingesta de Documentos

1. Guarda documento y metadata en MongoDB (`documents`)
2. Realiza chunking + genera embeddings determinísticos en MongoDB (`chunks`)
3. Extrae entidades y relaciones (regla naive) y hace upsert en Neo4j
4. Usa Outbox pattern en MongoDB (`graph_sync_outbox`) para sincronización con retries automáticos
5. Manejo de consistencia:
   - Si falla Neo4j, el documento queda en MongoDB marcado como `ERROR/FAILED`
   - Los eventos quedan en outbox y pueden reprocesarse

### Pipeline 2: Consultas GraphRAG

1. `POST /query` ejecuta GraphRAG básico:
   - Recupera contexto desde chunks en MongoDB (búsqueda híbrida)
   - Recupera hechos del grafo en Neo4j
   - Construye prompt grounded y genera respuesta local

## Endpoints API

- `GET /health` - Health check
- `POST /documents/text` - Ingesta de texto plano
- `POST /documents/upload` - Upload de archivos (txt/md/json/csv/pdf/docx)
- `GET /documents` - Listar documentos
- `POST /outbox/retry` - Reintentar eventos fallidos
- `POST /query` - Consultas con GraphRAG

## Configuración Local

### Variables de Entorno

Ver `.env.example` para configuración requerida:
- Conexiones a MongoDB y Neo4j
- Configuración del motor de búsqueda (`SEARCH_ENGINE=mongodb|elasticsearch`)
- Configuraciones de chunking y embeddings

### Arranque

```bash
# Levantar servicios (MongoDB, Neo4j)
docker compose -f docker-compose.yml up -d

# Configurar variables de entorno
cp .env.example .env

# Instalar dependencias
yarn install

# Modo desarrollo
yarn start:dev
```

## Patrones y Principios

### Arquitectura Hexagonal

- **Puertos**: Interfaces que definen contratos (ej: `ChunkSearchPort`)
- **Adaptadores**: Implementaciones concretas (ej: `MongoChunkSearchAdapter`, `ElasticsearchChunkSearchAdapter`)
- **Domain**: Libre de dependencias externas
- **Infrastructure**: Contiene todos los detalles técnicos

### Outbox Pattern

Garantiza consistencia eventual entre MongoDB y Neo4j:
- Eventos almacenados en `graph_sync_outbox`
- Retries automáticos con backoff
- Estado: `PENDING`, `PROCESSING`, `SUCCESS`, `ERROR`, `FAILED`

### Motor de Búsqueda Desacoplado

El puerto `ChunkSearchPort` permite cambiar fácilmente entre implementaciones:
- `MongoChunkSearchAdapter` (por defecto)
- `ElasticsearchChunkSearchAdapter` (cuando `SEARCH_ENGINE=elasticsearch`)

## Comandos Útiles

```bash
# Build de producción
yarn build

# Inicio en producción
yarn start

# Linting
yarn lint
```

## Estructura de Datos

### Documento
- Metadata: título, fuente, tipo, fechas
- Estado de procesamiento
- Referencias a chunks

### Chunk
- Texto del fragmento
- Embeddings vectoriales
- Posición en documento original
- Metadata heredada

### Grafo (Neo4j)
- Nodos: Entidades extraídas
- Relaciones: Conexiones semánticas
- Propiedades: Metadata contextual

## Notas de Desarrollo

- El proyecto usa arquitectura hexagonal estricta
- Los adaptadores son intercambiables siguiendo los puertos
- La consistencia se maneja con outbox pattern
- El sistema es extensible para nuevos motores de búsqueda y fuentes de datos

## Roadmap

- Mejora de extracción de entidades (LLM-based)
- Soporte para más formatos de documentos
- Optimización de búsqueda híbrida
- Implementación de caché distribuido
- Métricas y observabilidad
