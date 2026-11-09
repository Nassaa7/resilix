import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker.js';
import { withRetry, RetryOptions } from './retry.js';
import { withTimeout, TimeoutOptions } from './timeout.js';
import { RateLimiter } from './rate-limiter.js';
import { withFallback, FallbackOptions } from './fallback.js';

export interface PipelineConfig<T> {
  timeout?: Omit<TimeoutOptions, 'signal'>;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreaker | CircuitBreakerOptions;
  rateLimiter?: RateLimiter;
  fallback?: FallbackOptions<T>;
}

export class PipelineBuilder<T> {
  private fn: (signal?: AbortSignal) => Promise<T>;
  private timeoutConfig?: Omit<TimeoutOptions, 'signal'>;
  private retryConfig?: RetryOptions;
  private breaker?: CircuitBreaker;
  private limiter?: RateLimiter;
  private fallbackConfig?: FallbackOptions<T>;

  constructor(fn: (signal?: AbortSignal) => Promise<T>) {
    this.fn = fn;
  }

  /**
   * Enforces a timeout for each call attempt.
   */
  timeout(timeoutMs: number, message?: string): this {
    this.timeoutConfig = { timeoutMs, message };
    return this;
  }

  /**
   * Configures retry policy with exponential backoff.
   */
  retry(options: RetryOptions): this {
    this.retryConfig = options;
    return this;
  }

  /**
   * Attaches a Circuit Breaker instance or options.
   */
  circuitBreaker(breakerOrOptions: CircuitBreaker | CircuitBreakerOptions): this {
    if (breakerOrOptions instanceof CircuitBreaker) {
      this.breaker = breakerOrOptions;
    } else {
      this.breaker = new CircuitBreaker(breakerOrOptions);
    }
    return this;
  }

  /**
   * Attaches a token-bucket rate limiter.
   */
  rateLimit(limiter: RateLimiter): this {
    this.limiter = limiter;
    return this;
  }

  /**
   * Attaches graceful fallback handling.
   */
  fallback(options: FallbackOptions<T>): this {
    this.fallbackConfig = options;
    return this;
  }

  /**
   * Executes the pipeline with all configured resiliency patterns.
   */
  async execute(): Promise<T> {
    const runCore = async (): Promise<T> => {
      // 1. Rate Limiting check
      if (this.limiter) {
        await this.limiter.acquire(1);
      }

      // 2. Wrap target invocation with timeout if defined
      const executeOnce = async (): Promise<T> => {
        if (this.timeoutConfig) {
          return withTimeout(
            (signal) => this.fn(signal),
            this.timeoutConfig
          );
        }
        return this.fn();
      };

      // 3. Wrap with Circuit Breaker if defined
      const executeWithBreaker = async (): Promise<T> => {
        if (this.breaker) {
          return this.breaker.execute(executeOnce);
        }
        return executeOnce();
      };

      // 4. Wrap with Retry if defined
      if (this.retryConfig) {
        return withRetry(() => executeWithBreaker(), this.retryConfig);
      }

      return executeWithBreaker();
    };

    // 5. Wrap outer layer with fallback if defined
    if (this.fallbackConfig) {
      return withFallback(runCore, this.fallbackConfig);
    }

    return runCore();
  }
}

/**
 * Creates a fluent resilience pipeline for an asynchronous task.
 *
 * @example
 * ```ts
 * const result = await pipeline(() => fetchOrders())
 *   .timeout(2000)
 *   .retry({ maxAttempts: 3, backoffFactor: 2 })
 *   .circuitBreaker(sharedBreaker)
 *   .fallback({ fallback: [] })
 *   .execute();
 * ```
 */
export function pipeline<T>(fn: (signal?: AbortSignal) => Promise<T>): PipelineBuilder<T> {
  return new PipelineBuilder(fn);
}
