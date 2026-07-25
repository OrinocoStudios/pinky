import configuration from './configuration';

describe('OPENAI_EXTRA_HEADERS', () => {
  const original = process.env.OPENAI_EXTRA_HEADERS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.OPENAI_EXTRA_HEADERS;
    } else {
      process.env.OPENAI_EXTRA_HEADERS = original;
    }
  });

  it('defaults to no extra headers', () => {
    delete process.env.OPENAI_EXTRA_HEADERS;
    expect(configuration().llm.openai.extraHeaders).toEqual({});
  });

  it('parses a flat object of headers', () => {
    process.env.OPENAI_EXTRA_HEADERS = JSON.stringify({
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'secret',
    });

    expect(configuration().llm.openai.extraHeaders).toEqual({
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'secret',
    });
  });

  it('fails loudly instead of dropping a malformed auth header', () => {
    process.env.OPENAI_EXTRA_HEADERS = 'not json';
    expect(() => configuration()).toThrow(/JSON object/);

    process.env.OPENAI_EXTRA_HEADERS = '["a"]';
    expect(() => configuration()).toThrow(/JSON object/);

    process.env.OPENAI_EXTRA_HEADERS = JSON.stringify({ 'X-Num': 1 });
    expect(() => configuration()).toThrow(/must be strings \(offending: X-Num\)/);
  });
});
