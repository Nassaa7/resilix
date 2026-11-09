export type JitterMode = 'full' | 'decorrelated' | 'none';

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  error: unknown;
  delayMs: number;
}

export interface RetryOptions {
  /**
   * Total number of attempts (including the first attempt). Default: 3.
   */
  maxAttempts?: number;

  /**
   * Base delay in milliseconds before the first retry. Default: 100ms.
   */
  initialDelayMs?: number;

  /**
   * Maximum capped delay between retries. Default: 10000ms.
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff. Default: 2.
   */
  backoffFactor?: number;

  /**
   * Jitter strategy to prevent thundering herd problem. Default: 'full'.
   */
  jitter?: JitterMode;

  /**
   * Predicate to determine whether a given error should trigger a retry.
   * Default: always retries until maxAttempts is exhausted.
   */
  retryOn?: (error: unknown, attempt: number) => boolean | Promise<boolean>;

  /**
   * Hook executed before each retry delay begins.
   */
  onRetry?: (context: RetryContext) => void | Promise<void>;

  /**
   * Optional AbortSignal to cancel waiting retries.
   */
  signal?: AbortSignal;
}

/**
 * Calculates backoff delay with optional jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
  jitter: JitterMode,
  previousDelayMs?: number
): number {
  const baseExponential = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
  const cappedDelay = Math.min(baseExponential, maxDelayMs);

  switch (jitter) {
    case 'none':
      return Math.round(cappedDelay);
    case 'full':
      // Full Jitter: Sleep between 0 and cappedDelay
      return Math.round(Math.random() * cappedDelay);
    case 'decorrelated': {
      // Decorrelated Jitter: Sleep between initialDelay and 3 * previousDelay
      const prev = previousDelayMs ?? initialDelayMs;
      const sleep = Math.random() * (prev * 3 - initialDelayMs) + initialDelayMs;
      return Math.round(Math.min(maxDelayMs, Math.max(initialDelayMs, sleep)));
    }
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason ?? new Error('Retry aborted'));
    }

    const timer = setTimeout(() => {
      resolve();
    }, ms);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error('Retry aborted'));
      },
      { once: true }
    );
  });
}

/**
 * Executes a function with automatic retries and exponential backoff.
 *
 * @example
 * ```ts
 * const user = await withRetry(() => fetchUser(id), {
 *   maxAttempts: 4,
 *   initialDelayMs: 200,
 *   jitter: 'full',
 *   retryOn: (err) => isTransientNetworkError(err),
 * });
 * ```
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffFactor = 2,
    jitter = 'full',
    retryOn,
    onRetry,
    signal,
  } = options;

  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }

  let lastError: unknown;
  let previousDelayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw signal.reason ?? new Error('Operation aborted');
    }

    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt >= maxAttempts) {
        break;
      }

      if (retryOn) {
        const shouldRetry = await retryOn(err, attempt);
        if (!shouldRetry) {
          throw err;
        }
      }

      const delayMs = calculateBackoffDelay(
        attempt,
        initialDelayMs,
        maxDelayMs,
        backoffFactor,
        jitter,
        previousDelayMs
      );
      previousDelayMs = delayMs;

      if (onRetry) {
        await onRetry({ attempt, maxAttempts, error: err, delayMs });
      }

      await delay(delayMs, signal);
    }
  }

  throw lastError;
}
