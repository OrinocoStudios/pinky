import { applyTaskPrefix } from './embedding-prefix.util';

describe('applyTaskPrefix', () => {
  it('prefixes document texts with search_document for nomic models', () => {
    expect(applyTaskPrefix('nomic-embed-text', 'Lyme disease info', 'document')).toBe(
      'search_document: Lyme disease info',
    );
  });

  it('prefixes query texts with search_query for nomic models', () => {
    expect(applyTaskPrefix('nomic-embed-text', 'what is Lyme disease', 'query')).toBe(
      'search_query: what is Lyme disease',
    );
  });

  it('recognizes nomic gguf filenames as nomic models', () => {
    expect(
      applyTaskPrefix('nomic-embed-text-v1.5.Q5_K_M.gguf', 'chunk text', 'document'),
    ).toBe('search_document: chunk text');
  });

  it('leaves text untouched for non-nomic models', () => {
    expect(applyTaskPrefix('text-embedding-3-small', 'chunk text', 'document')).toBe(
      'chunk text',
    );
    expect(applyTaskPrefix('text-embedding-3-small', 'a query', 'query')).toBe('a query');
  });
});
