---
name: pinky-dev
description: >
  Develop features inside Pinky (Brain Service), the generic GraphRAG engine.
  Use when adding new modules, ports, adapters, use cases, controllers, or endpoints to Pinky.
  Use when modifying ingestion, query, search, graph, or document management code.
  Use when debugging build errors, test failures, or architectural issues in Pinky.
  Do NOT use for services that consume Pinky via HTTP — use pinky-consumer instead.
---

# Pinky Development Guide

## Project identity

Pinky is a generic GraphRAG engine (NestJS, TypeScript). It has no business logic — business domains (medical, trading, etc.) live in separate consuming services.

Read `AGENT.md` at the project root for rules and conventions before making changes.

## Adding a new feature — step by step

### 1. New port (domain contract)

Create `src/modules/<module>/domain/ports/<concept>.port.ts`:

```typescript
export interface MyPort {
  doSomething(input: MyInput): Promise<MyOutput>;
}
```

Register DI token in `src/shared/di.tokens.ts`:

```typescript
export const MY_PORT = Symbol('MY_PORT');
```

### 2. New adapter (infrastructure implementation)

Create `src/modules/<module>/infrastructure/<provider>/<provider>-<concept>.adapter.ts`:

```typescript
@Injectable()
export class ProviderMyAdapter implements MyPort {
  async doSomething(input: MyInput): Promise<MyOutput> { ... }
}
```

### 3. Wire in app.module.ts

```typescript
providers: [
  ProviderMyAdapter,
  { provide: MY_PORT, useExisting: ProviderMyAdapter },
]
```

For factory-based selection (like `LLM_PROVIDER`):

```typescript
{
  provide: MY_PORT,
  inject: [ConfigService, AdapterA, AdapterB],
  useFactory: (config, a, b) => config.get('myFlag') === 'a' ? a : b,
}
```

### 4. New use case

Create `src/modules/<module>/application/<action>.usecase.ts`:

```typescript
@Injectable()
export class MyUseCase {
  constructor(
    @Inject(MY_PORT) private readonly myPort: MyPort,
  ) {}

  async execute(input: MyInput): Promise<MyOutput> { ... }
}
```

Use cases inject ports via `@Inject(TOKEN)`, never import adapters directly.

### 5. New controller endpoint

Create or extend `src/modules/<module>/presentation/<module>.controller.ts`:

```typescript
@Post('my-action')
@RequireApiKey()
async myAction(
  @Body() body: MyDto,
  @Headers('x-tenant-id') tenantHeader?: string,
  @Headers('x-library-id') libraryHeader?: string,
) {
  const tenantId = this.resolveTenantId(tenantHeader);
  const libraryId = this.resolveLibraryId(libraryHeader);
  return this.myUseCase.execute({ tenantId, libraryId, ...body });
}
```

Always read both scope headers and propagate them.

### 6. Update test mocks

In `test/test-helpers.ts`, add the mock implementation for the new port and register it in `createTestApp`.

### 7. Validate

```bash
npm run build
npm run test:e2e
```

## Scoping — tenantId + libraryId

Every data path must propagate both optional scopes:
- Models: `tenantId?: string`, `libraryId?: string`
- Ports: add as trailing optional parameters
- MongoDB: use `buildScopeFilter(tenantId, libraryId)` helper in the repository
- Neo4j: add `$tenantId` and `$libraryId` parameters to Cypher queries
- Search: include in `ChunkSearchQuery`

For query-time multi-library support, use `libraryIds?: string[]` (array) in search/graph ports.

## Architecture reference

For detailed port signatures, model definitions, and adapter patterns, see:
- [references/ports.md](references/ports.md) — all port interfaces
- [references/module-map.md](references/module-map.md) — module layout and file locations
