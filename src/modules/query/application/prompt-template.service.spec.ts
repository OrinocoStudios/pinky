import { PromptTemplateService } from './prompt-template.service';

describe('PromptTemplateService', () => {
  const service = new PromptTemplateService();

  it('should include the user query in the prompt', () => {
    const { prompt } = service.buildGroundedPrompt({
      query: '¿Qué es GraphRAG?',
      contextSources: [],
      graphFacts: [],
    });

    expect(prompt).toContain('¿Qué es GraphRAG?');
  });

  it('should include context sources with CTX-N ids', () => {
    const { prompt, sources } = service.buildGroundedPrompt({
      query: 'test',
      contextSources: [
        { id: 'chunk-1', text: 'Neo4j is a graph database.' },
        { id: 'chunk-2', text: 'MongoDB stores documents.' },
      ],
      graphFacts: [],
    });

    expect(prompt).toContain('[CTX-1]: Neo4j is a graph database.');
    expect(prompt).toContain('[CTX-2]: MongoDB stores documents.');
    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({ id: 'CTX-1', text: 'Neo4j is a graph database.', type: 'chunk' });
  });

  it('should include graph facts with FACT-N ids', () => {
    const { prompt, sources } = service.buildGroundedPrompt({
      query: 'test',
      contextSources: [],
      graphFacts: [
        { id: 'rel-1', fromEntityId: 'Einstein', type: 'DEVELOPED', toEntityId: 'Relativity', confidence: 0.95 },
      ],
    });

    expect(prompt).toContain('[FACT-1]: Einstein -(DEVELOPED');
    expect(prompt).toContain('Relativity');
    expect(sources).toHaveLength(1);
    expect(sources[0].type).toBe('graph_fact');
  });

  it('should show fallback text when no context or facts', () => {
    const { prompt } = service.buildGroundedPrompt({
      query: 'test',
      contextSources: [],
      graphFacts: [],
    });

    expect(prompt).toContain('Sin contexto textual disponible.');
    expect(prompt).toContain('Sin hechos de grafo disponibles.');
  });

  it('should combine sources from both context and facts', () => {
    const { sources } = service.buildGroundedPrompt({
      query: 'test',
      contextSources: [{ id: 'c1', text: 'chunk text' }],
      graphFacts: [{ id: 'r1', fromEntityId: 'A', type: 'REL', toEntityId: 'B', confidence: 0.8 }],
    });

    expect(sources).toHaveLength(2);
    expect(sources[0].id).toBe('CTX-1');
    expect(sources[1].id).toBe('FACT-1');
  });
});
