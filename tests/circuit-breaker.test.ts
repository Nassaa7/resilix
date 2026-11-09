import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../src/index.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state and allows requests', async () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe('CLOSED');

    const result = await breaker.execute(async () => 'hello');
    expect(result).toBe('hello');
  });

  it('trips to OPEN state when failureThreshold is reached', async () => {
    const onStateChange = vi.fn();
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 100,
      onStateChange,
    });

    // 1st failure
    await expect(breaker.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    // 2nd failure -> trips OPEN
    await expect(breaker.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');
    expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN', 'default-breaker');

    // Subsequent call rejected immediately without executing target
    const target = vi.fn();
    await expect(breaker.execute(target)).rejects.toThrow(CircuitBreakerOpenError);
    expect(target).not.toHaveBeenCalled();
  });

  it('transitions to HALF_OPEN after resetTimeoutMs', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      halfOpenMaxSuccesses: 1,
    });

    await expect(breaker.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(breaker.getState()).toBe('HALF_OPEN');

    // Half open success transitions back to CLOSED
    const res = await breaker.execute(async () => 'recovered');
    expect(res).toBe('recovered');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
