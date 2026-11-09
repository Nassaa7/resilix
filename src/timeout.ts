import { TimeoutError } from './errors.js';

export interface TimeoutOptions {
  /**
   * Timeout duration in milliseconds.
   */
  timeoutMs: number;

  /**
   * Optional custom error message when the timeout triggers.
   */
  message?: string;

  /**
   * An optional parent AbortSignal to link cancellation.
   */
  signal?: AbortSignal;
}

/**
 * Executes an async task with an enforced maximum duration.
 * Provides an AbortSignal to the task for cooperative cancellation.
 *
 * @example
 * ```ts
 * const data = await withTimeout(
 *   async (signal) => fetch('https://api.example.com', { signal }),
 *   { timeoutMs: 3000 }
 * );
 * ```
 */
export async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, message, signal: parentSignal } = options;

  if (timeoutMs <= 0) {
    throw new Error('timeoutMs must be greater than 0');
  }

  if (parentSignal?.aborted) {
    throw parentSignal.reason ?? new Error('Operation already aborted');
  }

  const controller = new AbortController();

  // If a parent signal aborts first, abort our controller
  const onParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal) {
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new TimeoutError(timeoutMs, message);
      controller.abort(err);
      reject(err);
    }, timeoutMs);

    // Prevent timer from keeping the Node.js event loop alive if possible
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  try {
    return await Promise.race([task(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}
