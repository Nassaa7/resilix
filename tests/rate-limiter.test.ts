import { describe, it, expect } from 'vitest';
import { RateLimiter, RateLimitExceededError } from '../src/index.js';

describe('RateLimiter', () => {
  it('allows consumption within capacity', () => {
    const limiter = new RateLimiter({ capacity: 2 });
    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(false);
  });

  it('throws RateLimitExceededError on acquireOrThrow when capacity is depleted', () => {
    const limiter = new RateLimiter({ capacity: 1 });
    expect(limiter.tryAcquire(1)).toBe(true);
    expect(() => limiter.acquireOrThrow(1)).toThrow(RateLimitExceededError);
  });

  it('replenishes tokens over time', async () => {
    const limiter = new RateLimiter({
      capacity: 1,
      refillAmount: 1,
      intervalMs: 50,
    });

    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(limiter.tryAcquire(1)).toBe(true);
  });

  it('executes task through acquire queue', async () => {
    const limiter = new RateLimiter({ capacity: 1, refillAmount: 1, intervalMs: 30 });
    const res = await limiter.execute(async () => 'ok');
    expect(res).toBe('ok');
  });
});
