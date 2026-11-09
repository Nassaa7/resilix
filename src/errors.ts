/**
 * Base error class for all Resilix errors.
 */
export class ResilixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResilixError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an asynchronous operation exceeds the allowed execution time.
 */
export class TimeoutError extends ResilixError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when a call is rejected because the Circuit Breaker is in the OPEN state.
 */
export class CircuitBreakerOpenError extends ResilixError {
  readonly resetTimeoutMs: number;

  constructor(resetTimeoutMs: number, message?: string) {
    super(message ?? `Circuit breaker is OPEN. Calls are blocked for ${resetTimeoutMs}ms`);
    this.name = 'CircuitBreakerOpenError';
    this.resetTimeoutMs = resetTimeoutMs;
  }
}

/**
 * Thrown when rate limit capacity is exhausted and non-blocking acquire fails.
 */
export class RateLimitExceededError extends ResilixError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message?: string) {
    super(message ?? `Rate limit exceeded. Retry after ${retryAfterMs}ms`);
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
  }
}
