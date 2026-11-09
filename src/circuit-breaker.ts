import { CircuitBreakerOpenError } from './errors.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /**
   * Name of the breaker for logging/metrics.
   */
  name?: string;

  /**
   * Number of failures within the sample window that triggers the OPEN state.
   * Default: 5.
   */
  failureThreshold?: number;

  /**
   * How long to stay in the OPEN state before testing with HALF_OPEN (in milliseconds).
   * Default: 10000ms (10 seconds).
   */
  resetTimeoutMs?: number;

  /**
   * Number of successful requests in HALF_OPEN to transition back to CLOSED.
   * Default: 2.
   */
  halfOpenMaxSuccesses?: number;

  /**
   * Optional custom predicate to determine if an error counts as a failure.
   * By default, any thrown error is considered a failure.
   */
  isFailure?: (error: unknown) => boolean;

  /**
   * State change callback.
   */
  onStateChange?: (from: CircuitState, to: CircuitState, breakerName?: string) => void;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveSuccesses: number;
  lastStateChange: number;
}

export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private consecutiveSuccesses = 0;
  private lastStateChange: number = Date.now();
  private nextAttemptTimestamp = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxSuccesses: number;
  private readonly isFailure: (error: unknown) => boolean;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState, name?: string) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name ?? 'default-breaker';
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
    this.halfOpenMaxSuccesses = options.halfOpenMaxSuccesses ?? 2;
    this.isFailure = options.isFailure ?? (() => true);
    this.onStateChange = options.onStateChange;
  }

  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    this.checkStateTransition();
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Resets the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failureCount = 0;
    this.consecutiveSuccesses = 0;
  }

  /**
   * Executes a protected asynchronous operation.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkStateTransition();

    if (this.state === 'OPEN') {
      const remainingMs = Math.max(0, this.nextAttemptTimestamp - Date.now());
      throw new CircuitBreakerOpenError(remainingMs, `[${this.name}] Circuit is OPEN. Calls blocked.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (this.isFailure(err)) {
        this.onError();
      }
      throw err;
    }
  }

  private checkStateTransition(): void {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTimestamp) {
      this.transitionTo('HALF_OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'OPEN') {
      this.nextAttemptTimestamp = Date.now() + this.resetTimeoutMs;
    } else if (newState === 'HALF_OPEN') {
      this.consecutiveSuccesses = 0;
    } else if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.consecutiveSuccesses = 0;
    }

    if (this.onStateChange) {
      this.onStateChange(oldState, newState, this.name);
    }
  }

  private onSuccess(): void {
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.halfOpenMaxSuccesses) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  private onError(): void {
    this.failureCount++;

    if (this.state === 'HALF_OPEN') {
      // In half-open, any single error immediately trips back to OPEN
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }
}
