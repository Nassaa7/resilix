import { describe, it, expect, vi } from 'vitest';
import { withRetry, calculateBackoffDelay } from '../src/index.js';

describe('withRetry', () => {
  it('should succeed on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed if subsequent attempt passes', async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'recovered';
    });

    const result = await withRetry(fn, {
      maxAttempts: 4,
      initialDelayMs: 10,
      jitter: 'none',
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw last error when all attempts fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fatal error'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        jitter: 'none',
      })
    ).rejects.toThrow('Fatal error');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect retryOn predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('Non-retryable error'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        retryOn: (err) => !(err instanceof TypeError),
      })
    ).rejects.toThrow(TypeError);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should trigger onRetry hook before each retry', async () => {
    const onRetry = vi.fn();
    let count = 0;
    const fn = vi.fn().mockImplementation(async () => {
      count++;
      if (count < 2) throw new Error('fail');
      return 'done';
    });

    await withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        maxAttempts: 3,
      })
    );
  });

  it('calculates backoff delay correctly with none jitter', () => {
    const delay = calculateBackoffDelay(2, 100, 1000, 2, 'none');
    expect(delay).toBe(200);
  });
});
