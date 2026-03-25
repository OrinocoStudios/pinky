import { ChecksumService } from './checksum.service';

describe('ChecksumService', () => {
  const service = new ChecksumService();

  it('should return a 64-char hex string (SHA-256)', () => {
    const result = service.calculate('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be deterministic', () => {
    const a = service.calculate('same input');
    const b = service.calculate('same input');
    expect(a).toBe(b);
  });

  it('should produce different checksums for different inputs', () => {
    const a = service.calculate('input A');
    const b = service.calculate('input B');
    expect(a).not.toBe(b);
  });

  it('should handle empty string', () => {
    const result = service.calculate('');
    expect(result).toHaveLength(64);
  });
});
