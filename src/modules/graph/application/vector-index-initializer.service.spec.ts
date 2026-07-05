import { VectorIndexInitializerService } from './vector-index-initializer.service';

describe('VectorIndexInitializerService', () => {
  let embed: jest.Mock;
  let ensureVectorIndex: jest.Mock;
  let service: VectorIndexInitializerService;

  beforeEach(() => {
    jest.useFakeTimers();
    embed = jest.fn();
    ensureVectorIndex = jest.fn().mockResolvedValue(undefined);
    service = new VectorIndexInitializerService(
      { embed } as any,
      { ensureVectorIndex } as any,
    );
  });

  afterEach(() => {
    service.onApplicationShutdown();
    jest.useRealTimers();
  });

  it('creates the vector index on first try when the gateway is up', async () => {
    embed.mockResolvedValue([0.1, 0.2, 0.3]);

    await service.initialize();

    expect(ensureVectorIndex).toHaveBeenCalledWith(3);
    expect(service.isReady).toBe(true);
  });

  it('does not throw when the gateway is unreachable at boot', async () => {
    embed.mockRejectedValue(new Error('connect EHOSTUNREACH 192.168.1.10:8083'));

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(ensureVectorIndex).not.toHaveBeenCalled();
    expect(service.isReady).toBe(false);
  });

  it('retries with exponential backoff until the gateway comes back', async () => {
    embed
      .mockRejectedValueOnce(new Error('EHOSTUNREACH'))
      .mockRejectedValueOnce(new Error('EHOSTUNREACH'))
      .mockResolvedValue([0.1, 0.2]);

    await service.initialize();
    expect(embed).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5_000);
    expect(embed).toHaveBeenCalledTimes(2);

    // Backoff doubles: nothing at +5s, retry at +10s.
    await jest.advanceTimersByTimeAsync(5_000);
    expect(embed).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(embed).toHaveBeenCalledTimes(3);

    expect(ensureVectorIndex).toHaveBeenCalledTimes(1);
    expect(ensureVectorIndex).toHaveBeenCalledWith(2);
    expect(service.isReady).toBe(true);
  });

  it('is idempotent once ready: no further probes', async () => {
    embed.mockResolvedValue([0.1]);

    await service.initialize();
    await service.initialize();
    await jest.advanceTimersByTimeAsync(120_000);

    expect(embed).toHaveBeenCalledTimes(1);
    expect(ensureVectorIndex).toHaveBeenCalledTimes(1);
  });

  it('cancels pending retries on shutdown', async () => {
    embed.mockRejectedValue(new Error('EHOSTUNREACH'));

    await service.initialize();
    service.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(120_000);

    expect(embed).toHaveBeenCalledTimes(1);
  });
});
