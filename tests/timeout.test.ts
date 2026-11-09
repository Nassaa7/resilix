import { describe, it, expect } from 'vitest';
import { withTimeout, TimeoutError } from '../src/index.js';

describe('withTimeout', () => {
  it('should resolve if operation finishes before timeout', async () => {
    const result = await withTimeout(
      async () => {
        return 'success';
      },
      { timeoutMs: 500 }
    );
    expect(result).toBe('success');
  });

  it('should reject with TimeoutError when operation exceeds timeout', async () => {
    await expect(
      withTimeout(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return 'late';
        },
        { timeoutMs: 50 }
      )
    ).rejects.toThrow(TimeoutError);
  });

  it('should pass aborted signal to task when timeout fires', async () => {
    let wasSignalAborted = false;
    try {
      await withTimeout(
        async (signal) => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          wasSignalAborted = signal.aborted;
        },
        { timeoutMs: 50 }
      );
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
    }
    // give event loop a tick
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(wasSignalAborted).toBe(true);
  });

  it('should reject if parent signal is already aborted', async () => {
    const parentController = new AbortController();
    parentController.abort();

    await expect(
      withTimeout(async () => 'fast', {
        timeoutMs: 500,
        signal: parentController.signal,
      })
    ).rejects.toThrow();
  });
});
