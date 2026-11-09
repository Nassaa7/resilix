import { describe, it, expect, vi } from 'vitest';
import { withFallback } from '../src/index.js';

describe('withFallback', () => {
  it('returns original value on success', async () => {
    const res = await withFallback(async () => 'primary', {
      fallback: 'backup',
    });
    expect(res).toBe('primary');
  });

  it('returns static fallback on failure', async () => {
    const res = await withFallback(async () => { throw new Error('boom'); }, {
      fallback: 'backup',
    });
    expect(res).toBe('backup');
  });

  it('executes fallback function when failure occurs', async () => {
    const onFallback = vi.fn();
    const res = await withFallback(
      async () => { throw new Error('api error'); },
      {
        fallback: (err) => `recovered from ${(err as Error).message}`,
        onFallback,
      }
    );

    expect(res).toBe('recovered from api error');
    expect(onFallback).toHaveBeenCalled();
  });

  it('rethrows error when `when` filter returns false', async () => {
    await expect(
      withFallback(
        async () => { throw new RangeError('out of bounds'); },
        {
          fallback: 'ok',
          when: (err) => err instanceof TypeError,
        }
      )
    ).rejects.toThrow(RangeError);
  });
});
