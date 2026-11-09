import { describe, it, expect, vi } from 'vitest';
import { pipeline } from '../src/index.js';

describe('pipeline', () => {
  it('executes simple function in pipeline', async () => {
    const res = await pipeline(async () => 'success').execute();
    expect(res).toBe('success');
  });

  it('combines retry and fallback seamlessly', async () => {
    let attempts = 0;
    const res = await pipeline(async () => {
      attempts++;
      throw new Error('down');
    })
      .retry({ maxAttempts: 2, initialDelayMs: 5 })
      .fallback({ fallback: 'graceful-degrade' })
      .execute();

    expect(attempts).toBe(2);
    expect(res).toBe('graceful-degrade');
  });

  it('enforces timeout in pipeline', async () => {
    await expect(
      pipeline(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'too late';
      })
        .timeout(50)
        .execute()
    ).rejects.toThrow();
  });
});
