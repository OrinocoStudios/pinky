import { describe, expect, it } from 'vitest';
import { parseJsonObjectInput } from './document-forms';

describe('document form helpers', () => {
  it('returns undefined for blank input', () => {
    expect(parseJsonObjectInput('', 'Metadata')).toBeUndefined();
  });

  it('parses valid object json', () => {
    expect(parseJsonObjectInput('{"source":"manual"}', 'Metadata')).toEqual({ source: 'manual' });
  });

  it('rejects invalid json', () => {
    expect(() => parseJsonObjectInput('{bad}', 'Metadata')).toThrow('Metadata must be valid JSON');
  });

  it('rejects non-object json', () => {
    expect(() => parseJsonObjectInput('[1,2,3]', 'Metadata')).toThrow('Metadata must be a JSON object');
  });
});
