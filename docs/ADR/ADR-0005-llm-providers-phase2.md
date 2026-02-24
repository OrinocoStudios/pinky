# ADR-0005: Proveedores LLM con Citación de Fuentes (Fase 2)

**Estado**: Aceptado  
**Fecha**: 2026-02-24  
**Contexto**: Fase 2 - Respuesta LLM Grounded

---

## Contexto

En la Fase 1, el sistema implementó ingesta documental con GraphRAG básico usando un generador de respuestas local placeholder (`LocalAnswerGeneratorAdapter`). Este generador simplemente retornaba el prompt sin procesar, sin capacidad real de comprensión ni generación de respuestas inteligentes.

Para Fase 2, se requiere:
1. **Respuestas inteligentes** usando modelos LLM reales
2. **Control de alucinaciones** mediante grounding estricto en fuentes
3. **Citación trazable** de contextos y hechos de grafo
4. **Flexibilidad multi-proveedor** para evitar vendor lock-in
5. **Observabilidad** de uso (modelo, tokens, latencia)

## Decisión

Implementamos una arquitectura multi-proveedor con tres adaptadores:

### 1. OpenAI Adapter (Proveedor Principal)
- **Modelo por defecto**: `gpt-4o-mini`
- **SDK**: `openai` (^4.73.0)
- **Características**:
  - Timeout configurable (30s default)
  - Retry automático (3 intentos)
  - Manejo de errores específicos (401, 429, 404)
  - Logging de tokens y latencia
- **Configuración**:
  ```env
  LLM_PROVIDER=openai
  OPENAI_API_KEY=<key>
  OPENAI_MODEL=gpt-4o-mini
  OPENAI_TEMPERATURE=0.2
  OPENAI_MAX_TOKENS=1000
  OPENAI_TIMEOUT_MS=30000
  ```

### 2. Anthropic Adapter (Proveedor Alternativo)
- **Modelo por defecto**: `claude-3-5-sonnet-20241022`
- **SDK**: `@anthropic-ai/sdk` (^0.32.0)
- **Características similares** a OpenAI
- **Configuración**:
  ```env
  LLM_PROVIDER=anthropic
  ANTHROPIC_API_KEY=<key>
  ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
  ANTHROPIC_TEMPERATURE=0.2
  ANTHROPIC_MAX_TOKENS=1000
  ANTHROPIC_TIMEOUT_MS=30000
  ```

### 3. Local Adapter (Fallback/Desarrollo)
- **Propósito**: Desarrollo sin API keys, testing
- **Comportamiento**: Retorna prompt con metadata simulada
- **Sin costos** de API

### 4. Sistema de Citación de Fuentes

Implementamos `PromptTemplateService` que:
- Asigna IDs únicos a cada fuente:
  - `[CTX-1]`, `[CTX-2]`... para chunks de contexto
  - `[FACT-1]`, `[FACT-2]`... para hechos de grafo
- Construye prompts con instrucciones explícitas:
  - Solo usar información proporcionada
  - Citar fuentes con formato `[CTX-X]` o `[FACT-X]`
  - No inventar información
  - Declarar cuando no hay información suficiente
- Extrae automáticamente IDs citados desde la respuesta

### 5. Provider Factory

Factory pattern en `app.module.ts`:
```typescript
{
  provide: ANSWER_GENERATOR_PORT,
  useFactory: (config, local, openai, anthropic) => {
    switch (config.get('llm.provider')) {
      case 'openai': return openai;
      case 'anthropic': return anthropic;
      default: return local;
    }
  }
}
```

### 6. Contrato Extendido

```typescript
export type GenerateAnswerInput = {
  prompt: string;
  sources: AnswerSource[];  // IDs + texto + tipo
  maxTokens?: number;
};

export type GenerateAnswerOutput = {
  answer: string;
  sourcesUsed: string[];    // IDs citados
  model?: string;
  tokensUsed?: number;
};
```

## Consecuencias

### Positivas

✅ **Respuestas inteligentes** con LLMs de última generación  
✅ **Control de alucinaciones** mediante grounding estricto  
✅ **Trazabilidad completa** de fuentes citadas  
✅ **Flexibilidad multi-proveedor** (OpenAI, Anthropic, local)  
✅ **Observabilidad** (modelo, tokens, latencia, citaciones)  
✅ **Desarrollo sin costos** (modo local)  
✅ **Resiliencia** (retries, timeouts, fallbacks)  

### Negativas/Riesgos

⚠️ **Costos de API** proporcionales al uso  
⚠️ **Latencia** (respuestas de LLM pueden tomar 1-5s)  
⚠️ **Rate limiting** de proveedores  
⚠️ **Calidad de citación** depende de cumplimiento del LLM  
⚠️ **Dependencia de servicios externos**  

### Mitigaciones

- **Costos**: Modelos económicos por defecto (gpt-4o-mini), límite de tokens configurable
- **Latencia**: Timeout configurable (30s), respuesta inmediata en error
- **Rate limiting**: Retry con backoff exponencial, circuit breaker futuro
- **Calidad citación**: Instrucciones muy explícitas, validación en tests
- **Dependencia externa**: Modo local como fallback, soporte multi-proveedor

## Alternativas Consideradas

### 1. Proveedor único (OpenAI only)
- **Rechazado**: Vendor lock-in, sin fallback si hay problemas
- **Ventaja descartada**: Simplicidad

### 2. Modelos locales (Ollama, Llama, etc.)
- **Rechazado para Fase 2**: Mayor complejidad operativa, menor calidad inicial
- **Considerado para Fase 5**: Despliegue por instancia con modelos custom

### 3. Citación post-hoc (sin IDs en prompt)
- **Rechazado**: Menor precisión, sin trazabilidad garantizada
- **Ventaja descartada**: Prompts más cortos

### 4. Streaming de respuestas
- **Pospuesto**: Complejidad adicional innecesaria en Fase 2
- **Considerado para futuro**: Mejora de UX en respuestas largas

## Referencias

- OpenAI API Docs: https://platform.openai.com/docs/api-reference
- Anthropic API Docs: https://docs.anthropic.com/claude/reference
- EXECUTION_PLAN.md - Fase 2
- CHANGELOG.md - 2026-02-24 Fase 2

## Relacionado

- ADR-0001: Arquitectura Hexagonal (puertos permiten intercambio de adaptadores)
- ADR-0004: Pipeline GraphRAG (integración con query pipeline)
