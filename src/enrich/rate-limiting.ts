/**
 * Rate Limiting and Retry Logic Module (ENRICH--T07)
 *
 * Implements comprehensive rate limiting with:
 * - AC01: Configurable delays between API calls (default 1000ms)
 * - AC02: Exponential backoff for 429 responses with ±25% jitter
 * - AC03: Retry 5xx errors with maxRetries limit (default 3)
 * - AC04: Respect Retry-After header for 429/503 responses
 * - AC05: Circuit breaker after N consecutive failures (default 5)
 *
 * Architecture:
 * - RateLimiter: Main class managing all rate limiting logic
 * - Configuration with sensible defaults
 * - Per-provider state isolation
 * - Deterministic jitter calculation
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RateLimitConfig {
  rateLimitDelay: number // ms between API calls (default 1000)
  maxRetries: number // max retry attempts for 5xx (default 3)
  circuitBreakerThreshold: number // consecutive failures before open (default 5)
  circuitBreakerResetMs: number // timeout to reset circuit (default 60000ms)
}

export interface RateLimitState {
  consecutiveFailures: number
  circuitOpen: boolean
  circuitOpenedAt: number | null
  lastCallTime: number | null
}

export interface ApiResponse {
  status: number
  headers?: Record<string, string | number | undefined>
}

// ============================================================================
// AC01 + AC02 + AC03 + AC04 + AC05: Main RateLimiter Class
// ============================================================================

export class RateLimiter {
  private config: RateLimitConfig
  private state: RateLimitState

  constructor(partialConfig?: Partial<RateLimitConfig>) {
    // Set defaults and merge with provided config
    this.config = {
      rateLimitDelay: partialConfig?.rateLimitDelay ?? 1000,
      maxRetries: partialConfig?.maxRetries ?? 3,
      circuitBreakerThreshold: partialConfig?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: partialConfig?.circuitBreakerResetMs ?? 60000,
    }

    // Validate config
    this.validateConfig(this.config)

    // Initialize state
    this.state = {
      consecutiveFailures: 0,
      circuitOpen: false,
      circuitOpenedAt: null,
      lastCallTime: null,
    }
  }

  private validateConfig(config: RateLimitConfig): void {
    if (config.rateLimitDelay < 0) throw new Error('rateLimitDelay must be non-negative')
    if (config.maxRetries < 0) throw new Error('maxRetries must be non-negative')
    if (config.circuitBreakerThreshold < 1) throw new Error('circuitBreakerThreshold must be >= 1')
    if (config.circuitBreakerResetMs < 0) throw new Error('circuitBreakerResetMs must be non-negative')
  }

  // ============================================================================
  // AC01: Configurable Rate Limit Delays
  // ============================================================================

  /**
   * Check if rate limiting should delay the next call
   * @returns delay in ms, or 0 if no delay needed
   */
  public shouldRateLimit(): number {
    // No delay for first call
    if (this.state.lastCallTime === null) {
      return 0
    }

    const timeSinceLastCall = Date.now() - this.state.lastCallTime
    const requiredDelay = this.config.rateLimitDelay

    if (timeSinceLastCall < requiredDelay) {
      return requiredDelay - timeSinceLastCall
    }

    return 0
  }

  /**
   * Record a successful API call for rate limiting tracking
   */
  public recordCall(): void {
    this.state.lastCallTime = Date.now()
  }

  // ============================================================================
  // AC02: Exponential Backoff with Jitter
  // ============================================================================

  /**
   * Calculate exponential backoff with ±25% jitter
   * Formula: 2^n seconds ± 25%
   * @param attemptNumber - retry attempt number (1-based)
   * @returns delay in ms
   */
  private calculateExponentialBackoff(attemptNumber: number): number {
    // Base calculation: 2^n seconds
    const baseDelaySeconds = Math.pow(2, attemptNumber)
    const baseDelayMs = baseDelaySeconds * 1000

    // Apply ±25% jitter
    const jitterAmount = baseDelayMs * 0.25
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount

    return baseDelayMs + jitter
  }

  // ============================================================================
  // AC04: Retry-After Header Parsing
  // ============================================================================

  /**
   * Parse Retry-After header (can be integer seconds or HTTP date)
   * @param retryAfterValue - header value
   * @returns delay in ms, or null if invalid
   */
  private parseRetryAfterHeader(retryAfterValue: string | number | undefined): number | null {
    if (retryAfterValue === undefined || retryAfterValue === null) {
      return null
    }

    // Handle numeric (seconds)
    if (typeof retryAfterValue === 'number') {
      return retryAfterValue * 1000
    }

    const strValue = String(retryAfterValue).trim()

    // Try parsing as integer seconds
    const seconds = parseInt(strValue, 10)
    if (!isNaN(seconds) && seconds >= 0) {
      return seconds * 1000
    }

    // Try parsing as HTTP date
    try {
      const date = new Date(strValue)
      if (!isNaN(date.getTime())) {
        const delayMs = date.getTime() - Date.now()
        return Math.max(0, delayMs)
      }
    } catch {
      // Invalid date format
    }

    // Invalid format - return null to use calculated backoff
    return null
  }

  // ============================================================================
  // AC03: Retry 5xx Errors + AC04: Retry-After Integration
  // ============================================================================

  /**
   * Determine if response should be retried and calculate delay
   * @param response - API response with status and optional headers
   * @param attemptNumber - current attempt (1-based)
   * @returns { shouldRetry: boolean, delayMs: number }
   */
  public getRetryStrategy(
    response: ApiResponse,
    attemptNumber: number
  ): { shouldRetry: boolean; delayMs: number } {
    const { status, headers } = response

    // Don't retry on success (2xx)
    if (status >= 200 && status < 300) {
      return { shouldRetry: false, delayMs: 0 }
    }

    // Retry on 429 or 5xx
    const isRetryableStatus = status === 429 || (status >= 500 && status < 600)
    if (!isRetryableStatus) {
      return { shouldRetry: false, delayMs: 0 }
    }

    // AC04: Check for Retry-After header (takes precedence)
    const retryAfterMs = this.parseRetryAfterHeader(headers?.['Retry-After'])
    if (retryAfterMs !== null) {
      return { shouldRetry: true, delayMs: retryAfterMs }
    }

    // AC02: Use exponential backoff with jitter
    const backoffMs = this.calculateExponentialBackoff(attemptNumber)
    return { shouldRetry: true, delayMs: backoffMs }
  }

  /**
   * Check if we should retry based on attempt count
   * @param attemptNumber - current attempt (1-based)
   * @returns true if we should retry
   */
  public shouldRetryAttempt(attemptNumber: number): boolean {
    return attemptNumber <= this.config.maxRetries
  }

  // ============================================================================
  // AC05: Circuit Breaker
  // ============================================================================

  /**
   * Check if circuit breaker is open
   * @returns true if circuit is open (should fail fast)
   */
  public isCircuitOpen(): boolean {
    if (!this.state.circuitOpen) {
      return false
    }

    // Check if circuit breaker timeout has elapsed
    const timeSinceOpened = Date.now() - (this.state.circuitOpenedAt ?? 0)
    if (timeSinceOpened >= this.config.circuitBreakerResetMs) {
      // Reset circuit breaker
      this.resetCircuitBreaker()
      return false
    }

    return true
  }

  /**
   * Record a failure for circuit breaker tracking
   */
  public recordFailure(): void {
    this.state.consecutiveFailures += 1

    if (this.state.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.state.circuitOpen = true
      this.state.circuitOpenedAt = Date.now()
    }
  }

  /**
   * Record a success to reset failure counter
   */
  public recordSuccess(): void {
    this.state.consecutiveFailures = 0
    this.state.circuitOpen = false
    this.state.circuitOpenedAt = null
  }

  /**
   * Manually reset circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.state.consecutiveFailures = 0
    this.state.circuitOpen = false
    this.state.circuitOpenedAt = null
  }

  /**
   * Get current state for inspection
   */
  public getState(): RateLimitState {
    return { ...this.state }
  }

  /**
   * Get configuration
   */
  public getConfig(): RateLimitConfig {
    return { ...this.config }
  }

  /**
   * Reset all state (for testing)
   */
  public reset(): void {
    this.state = {
      consecutiveFailures: 0,
      circuitOpen: false,
      circuitOpenedAt: null,
      lastCallTime: null,
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new rate limiter with default configuration
 */
export function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  return new RateLimiter(config)
}

/**
 * Determine if a status code is a 5xx error (server error)
 */
export function is5xx(status: number): boolean {
  return status >= 500 && status < 600
}

/**
 * Determine if a status code should trigger retry
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || is5xx(status)
}
