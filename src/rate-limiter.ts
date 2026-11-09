import { RateLimitExceededError } from './errors.js';

export interface RateLimiterOptions {
  /**
   * Maximum capacity of tokens the bucket can hold.
   */
  capacity: number;

  /**
   * Number of tokens replenished per interval. Default: equal to capacity.
   */
  refillAmount?: number;

  /**
   * Interval duration in milliseconds for refill. Default: 1000ms.
   */
  intervalMs?: number;
}

export class RateLimiter {
  readonly capacity: number;
  readonly refillAmount: number;
  readonly intervalMs: number;

  private tokens: number;
  private lastRefillTimestamp: number;

  constructor(options: RateLimiterOptions) {
    if (options.capacity <= 0) {
      throw new Error('capacity must be greater than 0');
    }

    this.capacity = options.capacity;
    this.refillAmount = options.refillAmount ?? options.capacity;
    this.intervalMs = options.intervalMs ?? 1000;

    this.tokens = this.capacity;
    this.lastRefillTimestamp = Date.now();
  }

  /**
   * Returns current available tokens after computing replenishment.
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Non-blocking attempt to consume tokens.
   * Returns true if acquired, false otherwise.
   */
  tryAcquire(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /**
   * Acquires tokens or throws RateLimitExceededError if not enough tokens are available.
   */
  acquireOrThrow(cost = 1): void {
    if (!this.tryAcquire(cost)) {
      const missingTokens = cost - this.tokens;
      const refillCycles = Math.ceil(missingTokens / this.refillAmount);
      const retryAfterMs = refillCycles * this.intervalMs;
      throw new RateLimitExceededError(retryAfterMs);
    }
  }

  /**
   * Asynchronously waits until required tokens are replenished, then acquires them.
   */
  async acquire(cost = 1, maxWaitMs = 30000): Promise<void> {
    if (cost > this.capacity) {
      throw new Error(`Cost ${cost} exceeds total rate limiter capacity ${this.capacity}`);
    }

    const startTime = Date.now();

    while (!this.tryAcquire(cost)) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        throw new RateLimitExceededError(maxWaitMs, 'Wait time for rate limiter token exceeded');
      }

      // Calculate time needed for next token batch
      const missingTokens = cost - this.tokens;
      const waitTime = Math.min(
        Math.ceil((missingTokens / this.refillAmount) * this.intervalMs),
        maxWaitMs - elapsed
      );

      await new Promise((resolve) => setTimeout(resolve, Math.max(10, waitTime)));
    }
  }

  /**
   * Executes a task guarded by the rate limiter.
   */
  async execute<T>(fn: () => Promise<T>, cost = 1): Promise<T> {
    await this.acquire(cost);
    return fn();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTimestamp;

    if (elapsed >= this.intervalMs) {
      const refillPeriods = Math.floor(elapsed / this.intervalMs);
      this.tokens = Math.min(this.capacity, this.tokens + refillPeriods * this.refillAmount);
      this.lastRefillTimestamp = now - (elapsed % this.intervalMs);
    }
  }
}
