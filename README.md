# 🛡️ Resilix

> **Zero-dependency, lightweight resilience and fault-tolerance toolkit for modern Node.js & TypeScript.**

[![CI](https://github.com/Nassaa7/resilix/actions/workflows/ci.yml/badge.svg)](https://github.com/Nassaa7/resilix/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg)](#)

Distributed systems and microservices fail—networks drop, third-party APIs get overwhelmed, and timeouts happen. **Resilix** provides battle-tested, zero-overhead patterns to make your Node.js applications resilient, fault-tolerant, and self-healing.

---

## ⚡ Features

- **Exponential Backoff & Jitter Retry**: Full and decorrelated jitter strategies to eliminate the thundering herd problem.
- **Circuit Breaker**: Full three-state state machine (`CLOSED`, `OPEN`, `HALF_OPEN`) with customizable thresholds and metrics.
- **Timeout & Cooperative Cancellation**: Enforce execution deadlines with standard `AbortSignal` propagation.
- **Token-Bucket Rate Limiter**: High-performance in-memory rate limiting with non-blocking check and queue-based waiting.
- **Fallback Strategies**: Graceful degradation when services fail.
- **Fluent Pipeline**: Chain timeouts, circuit breakers, retries, rate limiters, and fallbacks in a clean, composable API.
- **Dual ESM / CJS**: Native ESM and CommonJS support with full TypeScript declarations.
- **Zero External Dependencies**: Pure, lightweight TypeScript (< 10 KB unpacked).

---

## 📦 Installation

```bash
npm install resilix
# or
pnpm add resilix
# or
yarn add resilix
```

---

## 🚀 Quick Start

### 1. Fluent Pipeline (All-in-One)

Combine multiple resilience strategies in seconds:

```typescript
import { pipeline, CircuitBreaker } from 'resilix';

const apiBreaker = new CircuitBreaker({
  name: 'payments-api',
  failureThreshold: 3,
  resetTimeoutMs: 15000,
});

const result = await pipeline(async (signal) => {
  return await fetch('https://api.payment-gateway.com/charge', { signal });
})
  .timeout(3000) // 3 second timeout
  .retry({ maxAttempts: 3, backoffFactor: 2, jitter: 'full' })
  .circuitBreaker(apiBreaker)
  .fallback({ fallback: { status: 'queued_offline' } })
  .execute();
```

---

### 2. Standalone Retry with Jitter

```typescript
import { withRetry } from 'resilix';

const user = await withRetry(
  async (attempt) => {
    return await fetchUserData(userId);
  },
  {
    maxAttempts: 4,
    initialDelayMs: 200,
    jitter: 'decorrelated',
    retryOn: (err) => err.code === 'ECONNRESET' || err.status >= 500,
    onRetry: ({ attempt, delayMs, error }) => {
      console.warn(`Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
    },
  }
);
```

---

### 3. Circuit Breaker

Prevent cascading failures when downstream services are down:

```typescript
import { CircuitBreaker, CircuitBreakerOpenError } from 'resilix';

const breaker = new CircuitBreaker({
  failureThreshold: 5,     // Trip after 5 consecutive failures
  resetTimeoutMs: 10000,   // Wait 10s before testing in HALF_OPEN
  halfOpenMaxSuccesses: 2, // 2 consecutive successes to close circuit
  onStateChange: (from, to, name) => {
    console.log(`[${name}] State transitioned from ${from} -> ${to}`);
  },
});

try {
  const data = await breaker.execute(() => callExternalService());
} catch (err) {
  if (err instanceof CircuitBreakerOpenError) {
    console.error('Downstream service is currently unavailable. Failing fast.');
  }
}
```

---

### 4. Timeout with AbortSignal

```typescript
import { withTimeout, TimeoutError } from 'resilix';

try {
  const response = await withTimeout(
    async (signal) => {
      const res = await fetch('https://example.com/data', { signal });
      return await res.json();
    },
    { timeoutMs: 2500 }
  );
} catch (err) {
  if (err instanceof TimeoutError) {
    console.error(`Request exceeded ${err.timeoutMs}ms limit.`);
  }
}
```

---

### 5. Rate Limiter (Token Bucket)

```typescript
import { RateLimiter } from 'resilix';

// Allow 10 requests every 1 second
const limiter = new RateLimiter({
  capacity: 10,
  refillAmount: 10,
  intervalMs: 1000,
});

// Blocks and waits for a token if limit is reached
await limiter.execute(async () => {
  return await sendWebhook(payload);
});
```

---

## 📖 API Reference

### `withRetry(fn, options)`
- `maxAttempts`: number (default: 3)
- `initialDelayMs`: number (default: 100)
- `maxDelayMs`: number (default: 10000)
- `backoffFactor`: number (default: 2)
- `jitter`: `'full' | 'decorrelated' | 'none'` (default: `'full'`)
- `retryOn`: `(error, attempt) => boolean`
- `onRetry`: `(context) => void`

### `CircuitBreaker(options)`
- `failureThreshold`: number (default: 5)
- `resetTimeoutMs`: number (default: 10000)
- `halfOpenMaxSuccesses`: number (default: 2)
- `getState()`: Returns `'CLOSED' | 'OPEN' | 'HALF_OPEN'`
- `getMetrics()`: Returns live execution statistics

---

## 🛠️ Testing & Building

```bash
# Run unit tests
npm test

# Build dual ESM/CJS output
npm run build

# Typecheck
npm run lint
```

---

## 📄 License

[MIT License](LICENSE) © 2026 [Nassaa7](https://github.com/Nassaa7)
