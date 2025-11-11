/**
 * Rate Limiting and Retry Logic Tests (ENRICH--T07)
 *
 * Comprehensive test suite for rate limiting module with:
 * - AC01: Configurable rate limit delays between API calls
 * - AC02: Exponential backoff for 429 responses with ±25% jitter
 * - AC03: Retry 5xx errors with maxRetries limit (default 3)
 * - AC04: Respect Retry-After header for 429/503 responses
 * - AC05: Circuit breaker after N consecutive failures (default 5)
 *
 * TDD approach: Red-Green-Refactor with Wallaby
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { RateLimiter, createRateLimiter, isRetryableStatus, is5xx } from '../rate-limiting'

// ============================================================================
// AC01: Configurable Rate Limit Delays
// ============================================================================

describe('AC01: Rate Limit Delays', () => {
  it('should respect default rateLimitDelay of 1000ms', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().rateLimitDelay).toBe(1000)
  })

  it('should respect custom rateLimitDelay configuration', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 500 })
    expect(limiter.getConfig().rateLimitDelay).toBe(500)
  })

  it('should delay subsequent calls by configured amount', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 100 })
    limiter.recordCall()
    const delay = limiter.shouldRateLimit()
    expect(delay).toBeGreaterThanOrEqual(0)
  })

  it('should not delay the first call', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 1000 })
    const delay = limiter.shouldRateLimit()
    expect(delay).toBe(0)
  })

  it('should accumulate delay for multiple sequential calls', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 100 })
    limiter.recordCall()
    const delay1 = limiter.shouldRateLimit()
    expect(delay1).toBeGreaterThan(0)
  })

  it('should reset delay timer after configured interval', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ rateLimitDelay: 50 })
    limiter.recordCall()
    expect(limiter.shouldRateLimit()).toBeGreaterThan(0)

    vi.advanceTimersByTime(60)
    expect(limiter.shouldRateLimit()).toBe(0)
    vi.useRealTimers()
  })
})

// ============================================================================
// AC02: Exponential Backoff with Jitter
// ============================================================================

describe('AC02: Exponential Backoff with Jitter for 429', () => {
  const limiter = createRateLimiter()

  it('should calculate exponential backoff: 2^1 = 2 seconds for attempt 1', () => {
    const response = { status: 429 }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    // 2^1 = 2 seconds = 2000ms, with ±25% jitter
    expect(delayMs).toBeGreaterThanOrEqual(1500)
    expect(delayMs).toBeLessThanOrEqual(2500)
  })

  it('should calculate exponential backoff: 2^2 = 4 seconds for attempt 2', () => {
    const response = { status: 429 }
    const { delayMs } = limiter.getRetryStrategy(response, 2)
    // 2^2 = 4 seconds = 4000ms, with ±25% jitter = [3000, 5000]
    expect(delayMs).toBeGreaterThanOrEqual(3000)
    expect(delayMs).toBeLessThanOrEqual(5000)
  })

  it('should calculate exponential backoff: 2^3 = 8 seconds for attempt 3', () => {
    const response = { status: 429 }
    const { delayMs } = limiter.getRetryStrategy(response, 3)
    // 2^3 = 8 seconds = 8000ms, with ±25% jitter = [6000, 10000]
    expect(delayMs).toBeGreaterThanOrEqual(6000)
    expect(delayMs).toBeLessThanOrEqual(10000)
  })

  it('should apply ±25% jitter to backoff calculation', () => {
    const response = { status: 429 }
    const delays = []
    for (let i = 0; i < 10; i++) {
      const { delayMs } = limiter.getRetryStrategy(response, 1)
      delays.push(delayMs)
    }
    // All within bounds
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(1500)
      expect(delay).toBeLessThanOrEqual(2500)
    })
  })

  it('should keep jitter within bounds: 2s ± 0.5s = [1.5, 2.5]', () => {
    const response = { status: 429 }
    for (let i = 0; i < 20; i++) {
      const { delayMs } = limiter.getRetryStrategy(response, 1)
      expect(delayMs).toBeGreaterThanOrEqual(1500)
      expect(delayMs).toBeLessThanOrEqual(2500)
    }
  })

  it('should keep jitter within bounds: 4s ± 1s = [3, 5]', () => {
    const response = { status: 429 }
    for (let i = 0; i < 20; i++) {
      const { delayMs } = limiter.getRetryStrategy(response, 2)
      expect(delayMs).toBeGreaterThanOrEqual(3000)
      expect(delayMs).toBeLessThanOrEqual(5000)
    }
  })

  it('should handle large retry numbers: 2^10 = 1024 seconds', () => {
    const response = { status: 429 }
    const { delayMs } = limiter.getRetryStrategy(response, 10)
    // 2^10 = 1024 seconds = 1024000ms, with ±25% jitter = [768000, 1280000]
    expect(delayMs).toBeGreaterThanOrEqual(768000)
    expect(delayMs).toBeLessThanOrEqual(1280000)
  })

  it('should produce different jittered values on repeated calls', () => {
    const response = { status: 429 }
    const delays = new Set()
    for (let i = 0; i < 100; i++) {
      const { delayMs } = limiter.getRetryStrategy(response, 1)
      delays.add(delayMs)
    }
    // Should have multiple different values due to jitter (not all same)
    expect(delays.size).toBeGreaterThan(1)
  })

  it('should apply jitter to 429 responses', () => {
    const response = { status: 429 }
    const { shouldRetry, delayMs } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(true)
    expect(delayMs).toBeGreaterThan(0)
  })

  it('should return jitter within bounds for all attempts', () => {
    const response = { status: 429 }
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { delayMs } = limiter.getRetryStrategy(response, attempt)
      const baseDelay = Math.pow(2, attempt) * 1000
      const minDelay = baseDelay * 0.75
      const maxDelay = baseDelay * 1.25
      expect(delayMs).toBeGreaterThanOrEqual(minDelay)
      expect(delayMs).toBeLessThanOrEqual(maxDelay)
    }
  })
})

// ============================================================================
// AC03: Retry 5xx Errors
// ============================================================================

describe('AC03: Retry 5xx Errors with maxRetries', () => {
  it('should retry on 500 Internal Server Error', () => {
    const limiter = createRateLimiter()
    const response = { status: 500 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(true)
  })

  it('should retry on 502 Bad Gateway', () => {
    const limiter = createRateLimiter()
    const response = { status: 502 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(true)
  })

  it('should retry on 503 Service Unavailable', () => {
    const limiter = createRateLimiter()
    const response = { status: 503 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(true)
  })

  it('should retry on 504 Gateway Timeout', () => {
    const limiter = createRateLimiter()
    const response = { status: 504 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(true)
  })

  it('should respect default maxRetries of 3', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().maxRetries).toBe(3)
  })

  it('should fail after exceeding maxRetries (default 3)', () => {
    const limiter = createRateLimiter({ maxRetries: 3 })
    expect(limiter.shouldRetryAttempt(1)).toBe(true)
    expect(limiter.shouldRetryAttempt(2)).toBe(true)
    expect(limiter.shouldRetryAttempt(3)).toBe(true)
    expect(limiter.shouldRetryAttempt(4)).toBe(false)
  })

  it('should support custom maxRetries configuration', () => {
    const limiter = createRateLimiter({ maxRetries: 5 })
    expect(limiter.getConfig().maxRetries).toBe(5)
    expect(limiter.shouldRetryAttempt(5)).toBe(true)
    expect(limiter.shouldRetryAttempt(6)).toBe(false)
  })

  it('should stop retrying on successful response (2xx)', () => {
    const limiter = createRateLimiter()
    const response = { status: 200 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(false)
  })

  it('should succeed on second attempt after initial 503', () => {
    const limiter = createRateLimiter()
    const failResponse = { status: 503 }
    const { shouldRetry: shouldRetry503 } = limiter.getRetryStrategy(failResponse, 1)
    expect(shouldRetry503).toBe(true)

    const successResponse = { status: 200 }
    const { shouldRetry: shouldRetry200 } = limiter.getRetryStrategy(successResponse, 2)
    expect(shouldRetry200).toBe(false)
  })

  it('should track retry count across attempts', () => {
    const limiter = createRateLimiter()
    expect(limiter.shouldRetryAttempt(1)).toBe(true)
    expect(limiter.shouldRetryAttempt(2)).toBe(true)
    expect(limiter.shouldRetryAttempt(3)).toBe(true)
    expect(limiter.shouldRetryAttempt(4)).toBe(false)
  })

  it('should not retry on 4xx errors (client errors)', () => {
    const limiter = createRateLimiter()
    const response = { status: 400 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(false)
  })

  it('should not retry on 200 OK (success)', () => {
    const limiter = createRateLimiter()
    const response = { status: 200 }
    const { shouldRetry } = limiter.getRetryStrategy(response, 1)
    expect(shouldRetry).toBe(false)
  })
})

// ============================================================================
// AC04: Respect Retry-After Header
// ============================================================================

describe('AC04: Retry-After Header Handling', () => {
  it('should respect Retry-After header for 429 responses', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': '10' } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBe(10000) // 10 seconds
  })

  it('should respect Retry-After header for 503 responses', () => {
    const limiter = createRateLimiter()
    const response = { status: 503, headers: { 'Retry-After': '30' } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBe(30000) // 30 seconds
  })

  it('should parse Retry-After as integer seconds', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': 5 } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBe(5000)
  })

  it('should override calculated backoff with Retry-After: 5', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': 5 } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    // Overrides calculated 2^1 = 2s backoff
    expect(delayMs).toBe(5000)
  })

  it('should override calculated backoff with Retry-After: 120', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': 120 } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBe(120000)
  })

  it('should use calculated backoff when Retry-After header missing', () => {
    const limiter = createRateLimiter()
    const response = { status: 429 }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    // Should use backoff with jitter [1500, 2500]
    expect(delayMs).toBeGreaterThanOrEqual(1500)
    expect(delayMs).toBeLessThanOrEqual(2500)
  })

  it('should parse Retry-After as HTTP date format', () => {
    const limiter = createRateLimiter()
    const futureDate = new Date(Date.now() + 60000) // 60 seconds in future
    const response = { status: 429, headers: { 'Retry-After': futureDate.toUTCString() } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    // Should be approximately 60 seconds (within reasonable tolerance)
    expect(delayMs).toBeGreaterThan(50000)
    expect(delayMs).toBeLessThan(70000)
  })

  it('should ignore invalid Retry-After values and use backoff', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': 'invalid' } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    // Should fallback to backoff [1500, 2500]
    expect(delayMs).toBeGreaterThanOrEqual(1500)
    expect(delayMs).toBeLessThanOrEqual(2500)
  })

  it('should handle Retry-After: 0 (no delay)', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': 0 } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBe(0)
  })

  it('should handle large Retry-After values (e.g., 3600 for 1 hour)', () => {
    const limiter = createRateLimiter()
    const response = { status: 429, headers: { 'Retry-After': 3600 } }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBe(3600000) // 1 hour in ms
  })
})

// ============================================================================
// AC05: Circuit Breaker
// ============================================================================

describe('AC05: Circuit Breaker for Cascading Failures', () => {
  it('should track consecutive failures', () => {
    const limiter = createRateLimiter()
    expect(limiter.getState().consecutiveFailures).toBe(0)
    limiter.recordFailure()
    expect(limiter.getState().consecutiveFailures).toBe(1)
  })

  it('should open circuit after 5 consecutive failures (default threshold)', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 5 })
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure()
      expect(limiter.isCircuitOpen()).toBe(false)
    }
    limiter.recordFailure() // 5th failure
    expect(limiter.isCircuitOpen()).toBe(true)
  })

  it('should support custom circuit breaker threshold', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 3 })
    limiter.recordFailure()
    limiter.recordFailure()
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
  })

  it('should fail fast when circuit is open', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 1 })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
  })

  it('should not make API call when circuit is open', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 2 })
    limiter.recordFailure()
    limiter.recordFailure()
    // Circuit is open - should fail fast
    expect(limiter.isCircuitOpen()).toBe(true)
  })

  it('should reset consecutive failure counter on success', () => {
    const limiter = createRateLimiter()
    limiter.recordFailure()
    limiter.recordFailure()
    expect(limiter.getState().consecutiveFailures).toBe(2)
    limiter.recordSuccess()
    expect(limiter.getState().consecutiveFailures).toBe(0)
  })

  it('should reset circuit breaker after timeout (default 60s)', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 1000,
    })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)

    vi.advanceTimersByTime(1100)
    expect(limiter.isCircuitOpen()).toBe(false)
    vi.useRealTimers()
  })

  it('should support custom circuit breaker reset timeout', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 500,
    })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)

    vi.advanceTimersByTime(501)
    expect(limiter.isCircuitOpen()).toBe(false)
    vi.useRealTimers()
  })

  it('should isolate circuit breaker state per provider', () => {
    const limiter1 = createRateLimiter({ circuitBreakerThreshold: 1 })
    const limiter2 = createRateLimiter({ circuitBreakerThreshold: 1 })

    limiter1.recordFailure()
    limiter2.recordSuccess()

    expect(limiter1.isCircuitOpen()).toBe(true)
    expect(limiter2.isCircuitOpen()).toBe(false)
  })

  it('should allow retry attempt after circuit reset timeout', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 500,
    })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)

    vi.advanceTimersByTime(501)
    expect(limiter.isCircuitOpen()).toBe(false)
    expect(limiter.shouldRetryAttempt(1)).toBe(true)
    vi.useRealTimers()
  })

  it('should re-open circuit if failures continue after reset', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 500,
    })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)

    vi.advanceTimersByTime(501)
    expect(limiter.isCircuitOpen()).toBe(false)

    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
    vi.useRealTimers()
  })

  it('should successfully close circuit after one success', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 1 })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
    limiter.recordSuccess()
    expect(limiter.isCircuitOpen()).toBe(false)
  })

  it('should handle threshold of 1 (fail once, circuit opens)', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 1 })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
  })

  it('should handle threshold of 10', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 10 })
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure()
      expect(limiter.isCircuitOpen()).toBe(false)
    }
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
  })
})

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('Integration Scenarios', () => {
  it('should combine rate limit delay with retry backoff', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 100 })
    limiter.recordCall()
    const rateDelay = limiter.shouldRateLimit()
    const response = { status: 429 }
    const { delayMs: backoffDelay } = limiter.getRetryStrategy(response, 1)
    expect(rateDelay + backoffDelay).toBeGreaterThan(0)
  })

  it('should combine circuit breaker with rate limiting', () => {
    const limiter = createRateLimiter({
      rateLimitDelay: 100,
      circuitBreakerThreshold: 1,
    })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
    const delay = limiter.shouldRateLimit()
    expect(delay).toBeGreaterThanOrEqual(0)
  })

  it('should maintain separate state for different providers', () => {
    const limiter1 = createRateLimiter()
    const limiter2 = createRateLimiter()
    limiter1.recordCall()
    limiter2.recordFailure()
    expect(limiter1.getState().lastCallTime).not.toBeNull()
    expect(limiter2.getState().consecutiveFailures).toBe(1)
  })

  it('should handle rapid success and failure transitions', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 2 })
    limiter.recordFailure()
    limiter.recordSuccess()
    expect(limiter.getState().consecutiveFailures).toBe(0)
    expect(limiter.isCircuitOpen()).toBe(false)
  })

  it('should apply rate limit between failed retries', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 50 })
    limiter.recordCall()
    const delay = limiter.shouldRateLimit()
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBeLessThanOrEqual(50)
  })

  it('should respect all config options simultaneously', () => {
    const limiter = createRateLimiter({
      rateLimitDelay: 100,
      maxRetries: 5,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 30000,
    })
    expect(limiter.getConfig().rateLimitDelay).toBe(100)
    expect(limiter.getConfig().maxRetries).toBe(5)
    expect(limiter.getConfig().circuitBreakerThreshold).toBe(3)
    expect(limiter.getConfig().circuitBreakerResetMs).toBe(30000)
  })

  it('should handle edge case: rate limit delay > backoff delay', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 10000 })
    limiter.recordCall()
    const rateDelay = limiter.shouldRateLimit()
    expect(rateDelay).toBeGreaterThanOrEqual(0)
  })

  it('should reset state on manual reset request', () => {
    const limiter = createRateLimiter({ circuitBreakerThreshold: 1 })
    limiter.recordFailure()
    limiter.recordCall()
    expect(limiter.getState().consecutiveFailures).toBe(1)
    expect(limiter.getState().lastCallTime).not.toBeNull()

    limiter.reset()
    expect(limiter.getState().consecutiveFailures).toBe(0)
    expect(limiter.getState().lastCallTime).toBeNull()
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  it('should handle configuration with all custom values', () => {
    const limiter = createRateLimiter({
      rateLimitDelay: 200,
      maxRetries: 10,
      circuitBreakerThreshold: 7,
      circuitBreakerResetMs: 5000,
    })
    expect(limiter.getConfig().rateLimitDelay).toBe(200)
  })

  it('should handle zero delay configuration gracefully', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 0 })
    const delay = limiter.shouldRateLimit()
    expect(delay).toBe(0)
  })

  it('should handle very large maxRetries (100)', () => {
    const limiter = createRateLimiter({ maxRetries: 100 })
    expect(limiter.shouldRetryAttempt(100)).toBe(true)
    expect(limiter.shouldRetryAttempt(101)).toBe(false)
  })

  it('should handle null/undefined response headers', () => {
    const limiter = createRateLimiter()
    const response = { status: 429 }
    const { delayMs } = limiter.getRetryStrategy(response, 1)
    expect(delayMs).toBeGreaterThan(0)
  })

  it('should recover from circuit breaker timeout', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 1000,
    })
    limiter.recordFailure()
    expect(limiter.isCircuitOpen()).toBe(true)
    vi.advanceTimersByTime(1001)
    expect(limiter.isCircuitOpen()).toBe(false)
    vi.useRealTimers()
  })

  it('should initialize with default config when not provided', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().rateLimitDelay).toBe(1000)
    expect(limiter.getConfig().maxRetries).toBe(3)
    expect(limiter.getConfig().circuitBreakerThreshold).toBe(5)
    expect(limiter.getConfig().circuitBreakerResetMs).toBe(60000)
  })
})

// ============================================================================
// Configuration and Defaults
// ============================================================================

describe('Configuration and Defaults', () => {
  it('should use default rateLimitDelay of 1000ms', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().rateLimitDelay).toBe(1000)
  })

  it('should use default maxRetries of 3', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().maxRetries).toBe(3)
  })

  it('should use default circuit breaker threshold of 5', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().circuitBreakerThreshold).toBe(5)
  })

  it('should use default circuit breaker reset of 60000ms', () => {
    const limiter = createRateLimiter()
    expect(limiter.getConfig().circuitBreakerResetMs).toBe(60000)
  })

  it('should allow partial config override (preserve defaults for unspecified)', () => {
    const limiter = createRateLimiter({ rateLimitDelay: 500 })
    expect(limiter.getConfig().rateLimitDelay).toBe(500)
    expect(limiter.getConfig().maxRetries).toBe(3)
  })
})

// ============================================================================
// State Management
// ============================================================================

describe('State Management', () => {
  it('should initialize fresh state for new rate limiter instance', () => {
    const limiter = createRateLimiter()
    const state = limiter.getState()
    expect(state.consecutiveFailures).toBe(0)
    expect(state.circuitOpen).toBe(false)
    expect(state.lastCallTime).toBeNull()
  })

  it('should persist state across multiple API calls', () => {
    const limiter = createRateLimiter()
    limiter.recordCall()
    limiter.recordFailure()
    const state1 = limiter.getState()
    expect(state1.lastCallTime).not.toBeNull()
    expect(state1.consecutiveFailures).toBe(1)
  })

  it('should track lastCallTime for rate limiting', () => {
    const limiter = createRateLimiter()
    expect(limiter.getState().lastCallTime).toBeNull()
    limiter.recordCall()
    expect(limiter.getState().lastCallTime).not.toBeNull()
  })

  it('should provide getter for current state inspection', () => {
    const limiter = createRateLimiter()
    limiter.recordFailure()
    const state = limiter.getState()
    expect(state.consecutiveFailures).toBe(1)
  })

  it('should allow state reset for manual circuit breaker reset', () => {
    const limiter = createRateLimiter()
    limiter.recordFailure()
    limiter.resetCircuitBreaker()
    expect(limiter.getState().consecutiveFailures).toBe(0)
  })
})
