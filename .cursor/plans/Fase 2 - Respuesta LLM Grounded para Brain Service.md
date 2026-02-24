# Fase 2 - Respuesta LLM Grounded
## Objetivo
Generar respuesta final con adapter LLM real y control de alucinaciones, reemplazando el generador local placeholder por una implementación productiva que use proveedores LLM externos (OpenAI/Anthropic).
## Estado Actual
### Implementación Existente
Actualmente el sistema tiene:
* `AnswerGeneratorPort` definido en `src/modules/query/domain/ports/answer-generator.port.ts` con interfaz simple: `generate(prompt: string): Promise<string>`
* `LocalAnswerGeneratorAdapter` en `src/modules/query/infrastructure/local/local-answer-generator.adapter.ts` que retorna una respuesta determinística sin usar LLM real
* `GraphRagQueryUseCase` en `src/modules/query/application/graph-rag-query.usecase.ts` que construye prompt grounded con:
    * Contexto recuperado de chunks (búsqueda híbrida)
    * Hechos verificados del grafo Neo4j
    * Prompt estructurado con instrucciones claras
### Limitaciones Actuales
* No hay integración real con proveedores LLM
* Sin control de alucinaciones
* Sin citación de fuentes
* Sin manejo de errores de proveedor externo
* Sin timeout ni retries
* No hay trazabilidad de qué fuentes se usaron en la respuesta
## Componentes a Implementar
### 1. Nuevo Adaptador LLM (OpenAI)
Crear `OpenAiAnswerGeneratorAdapter` en `src/modules/query/infrastructure/openai/openai-answer-generator.adapter.ts`
**Responsabilidades:**
* Implementar `AnswerGeneratorPort`
* Integración con OpenAI API (usando SDK oficial)
* Configuración de modelo (gpt-4o, gpt-4o-mini, etc.)
* Manejo de timeout y retries
* Control de tokens y límites
* Manejo robusto de errores de API
**Configuración requerida:**
* `OPENAI_API_KEY`: API key de OpenAI
* `OPENAI_MODEL`: Modelo a usar (default: gpt-4o-mini)
* `OPENAI_TEMPERATURE`: Temperatura para generación (default: 0.2 para respuestas más determinísticas)
* `OPENAI_MAX_TOKENS`: Límite de tokens en respuesta (default: 1000)
* `OPENAI_TIMEOUT_MS`: Timeout en milisegundos (default: 30000)
### 2. Adaptador Alternativo (Anthropic)
Crear `AnthropicAnswerGeneratorAdapter` en `src/modules/query/infrastructure/anthropic/anthropic-answer-generator.adapter.ts`
**Responsabilidades:**
* Implementar `AnswerGeneratorPort`
* Integración con Anthropic API (Claude)
* Configuración de modelo (claude-3-5-sonnet, etc.)
* Timeout y retries
* Manejo de errores
**Configuración requerida:**
* `ANTHROPIC_API_KEY`: API key de Anthropic
* `ANTHROPIC_MODEL`: Modelo a usar (default: claude-3-5-sonnet-20241022)
* `ANTHROPIC_TEMPERATURE`: Temperatura (default: 0.2)
* `ANTHROPIC_MAX_TOKENS`: Límite de tokens (default: 1000)
* `ANTHROPIC_TIMEOUT_MS`: Timeout (default: 30000)
### 3. Selector de Proveedor
Modificar configuración para permitir selección de proveedor LLM:
* Variable `LLM_PROVIDER`: 'openai' | 'anthropic' | 'local'
* Provider factory en módulo que inyecta el adaptador correcto según configuración
### 4. Mejora del Puerto `AnswerGeneratorPort`
Extender interfaz para incluir metadata:
```typescript
export type GenerateAnswerInput = {
  prompt: string;
  sources: AnswerSource[];
  maxTokens?: number;
};
export type AnswerSource = {
  id: string;
  text: string;
  type: 'chunk' | 'graph_fact';
};
export type GenerateAnswerOutput = {
  answer: string;
  sourcesUsed: string[]; // IDs de fuentes citadas
  model?: string;
  tokensUsed?: number;
};
export interface AnswerGeneratorPort {
  generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
}
```
### 5. Plantilla de Prompt Estricta
Crear `PromptTemplateService` en `src/modules/query/application/prompt-template.service.ts`
**Responsabilidades:**
* Construir prompts estructurados con instrucciones claras
* Incluir fuentes numeradas con IDs trazables
* Instrucciones explícitas anti-alucinación
* Formato de citación requerido
**Ejemplo de template:**
```warp-runnable-command
Eres un asistente que responde preguntas basándote ÚNICAMENTE en el contexto y hechos proporcionados.
REGLAS ESTRICTAS:
1. Solo usa información del contexto y hechos proporcionados
2. Si no tienes información suficiente, di "No tengo información suficiente para responder"
3. Cita las fuentes usando [Fuente-ID] al final de cada afirmación
4. No inventes información ni hagas suposiciones
PREGUNTA: {query}
CONTEXTO TEXTUAL:
{context_with_ids}
HECHOS DEL GRAFO:
{facts_with_ids}
RESPUESTA:
```
### 6. Actualización de `GraphRagQueryUseCase`
Modificar caso de uso para:
* Usar nuevo puerto con metadata
* Pasar fuentes con IDs trazables
* Retornar información de citación
* Manejar errores de generación con fallback
### 7. Actualización del DTO de Respuesta
Modificar `src/modules/query/presentation/query.dto.ts` para incluir:
```typescript
export class QueryResponseDto {
  answer: string;
  sourcesUsed: string[];
  fastContext: Array<{ id: string; text: string }>;
  truthFacts: Array<{ from: string; relation: string; to: string; id: string }>;
  model?: string;
  tokensUsed?: number;
}
```
### 8. Manejo de Errores y Resiliencia
**Estrategias:**
* Timeout configurable (default 30s)
* Retry exponencial (3 intentos con backoff)
* Circuit breaker para fallos consecutivos
* Logging estructurado de errores
* Fallback a respuesta de error informativa cuando LLM falla
**Tipos de error a manejar:**
* Timeout de API
* Rate limiting (429)
* Errores de autenticación (401)
* Errores de modelo no disponible (404)
* Errores de validación de contenido
* Errores de red
### 9. Configuración y Variables de Entorno
Actualizar `.env.example` y `src/config/configuration.ts`:
```warp-runnable-command
# LLM Configuration
LLM_PROVIDER=openai
# OpenAI Configuration
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=1000
OPENAI_TIMEOUT_MS=30000
# Anthropic Configuration (alternative)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.2
ANTHROPIC_MAX_TOKENS=1000
ANTHROPIC_TIMEOUT_MS=30000
```
### 10. Instalación de Dependencias
**Nuevas dependencias necesarias:**
```json
{
  "dependencies": {
    "openai": "^4.73.0",
    "@anthropic-ai/sdk": "^0.32.0",
    "axios-retry": "^4.5.0"
  }
}
```
## Plan de Implementación
### Paso 1: Configuración Base
* Actualizar `.env.example` con variables LLM
* Extender `BrainConfig` en `configuration.ts` con configuración LLM
* Actualizar `package.json` con nuevas dependencias
* Ejecutar `yarn install`
### Paso 2: Actualizar Puerto y DTOs
* Extender `AnswerGeneratorPort` con nueva interfaz
* Actualizar DTOs de query con campos de citación
* Actualizar `LocalAnswerGeneratorAdapter` para cumplir nueva interfaz
### Paso 3: Servicio de Templates
* Crear `PromptTemplateService`
* Implementar construcción de prompts con IDs trazables
* Agregar tests unitarios de templates
### Paso 4: Adaptador OpenAI
* Crear estructura de carpetas `infrastructure/openai/`
* Implementar `OpenAiAnswerGeneratorAdapter`
* Configurar timeout y retry logic
* Implementar manejo de errores específicos de OpenAI
* Tests de integración (con mocks)
### Paso 5: Adaptador Anthropic
* Crear estructura de carpetas `infrastructure/anthropic/`
* Implementar `AnthropicAnswerGeneratorAdapter`
* Configurar timeout y retry logic
* Implementar manejo de errores específicos de Anthropic
* Tests de integración (con mocks)
### Paso 6: Provider Factory
* Crear factory en módulo de query
* Implementar selección de proveedor según configuración
* Configurar inyección de dependencias en `app.module.ts`
### Paso 7: Actualizar Caso de Uso
* Modificar `GraphRagQueryUseCase` para usar nuevo puerto
* Integrar `PromptTemplateService`
* Pasar fuentes con IDs trazables
* Manejar errores con fallbacks
### Paso 8: Actualizar Controlador
* Modificar respuesta de `POST /query` con nueva estructura
* Agregar logs estructurados
* Documentar endpoint actualizado
### Paso 9: Testing
* Tests unitarios de adaptadores
* Tests de integración con API real (opcional, con keys de test)
* Tests E2E del flujo completo
* Validar citación de fuentes
### Paso 10: Documentación
* Actualizar `CHANGELOG.md` con cambios de Fase 2
* Crear ADR para decisión de proveedores LLM
* Actualizar `WARP.md` con nueva arquitectura
* Documentar en README como configurar API keys
## Criterios de Éxito
* ✅ `POST /query` responde con salida grounded usando adapter LLM real
* ✅ Respuesta incluye evidencia trazable de contexto y grafo (IDs de fuentes)
* ✅ Sistema soporta múltiples proveedores LLM (OpenAI, Anthropic, local)
* ✅ Manejo robusto de errores con timeout y retries
* ✅ Respuestas incluyen citación de fuentes
* ✅ Configuración flexible por variables de entorno
* ✅ Tests cubren casos de éxito y error
* ✅ Documentación actualizada
## Riesgos y Mitigaciones
### Riesgo: Latencia alta de LLM
**Mitigación:**
* Timeout configurable (30s default)
* Respuesta inmediata de error si timeout
* Considerar caché de respuestas similares en futuras fases
### Riesgo: Costos de API
**Mitigación:**
* Usar modelos más económicos por default (gpt-4o-mini)
* Límite de tokens configurable
* Logs de uso para monitoreo
* Rate limiting en endpoint si es necesario
### Riesgo: Rate limiting de proveedores
**Mitigación:**
* Retry con backoff exponencial
* Circuit breaker para fallos consecutivos
* Soporte de múltiples proveedores como fallback
### Riesgo: Calidad de citación inconsistente
**Mitigación:**
* Instrucciones muy explícitas en prompt
* Validación de formato de respuesta
* Logging de respuestas sin citación para análisis
## Dependencias Externas
* OpenAI API (requiere API key)
* Anthropic API (requiere API key, opcional)
* Conexión a internet estable
## Notas de Implementación
* Mantener `LocalAnswerGeneratorAdapter` como opción para desarrollo sin API keys
* Considerar variables de entorno sensibles nunca en repositorio
* Usar secrets management en producción
* Los adaptadores deben ser intercambiables sin cambios en caso de uso
