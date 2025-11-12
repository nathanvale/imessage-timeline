/**
 * Global Vitest setup file
 * Spec §9: Testing & CI - Global test setup
 *
 * This file runs before all test suites to configure the global test environment.
 * Used for:
 * - Setting up test utilities
 * - Configuring global mocks
 * - Initializing test environment variables
 * - Loading test-specific polyfills
 */

import '@testing-library/jest-dom/vitest'
import { beforeEach, afterEach, vi } from 'vitest'

// Global test setup can be added here
// For example:
// - Setup global test doubles
// - Configure test environment variables
// - Initialize shared test utilities

// Ensure clean state between test suites
// Force UTC timezone for consistent date parsing/formatting across environments
process.env.TZ = 'UTC'

// Silence EventEmitter MaxListeners warnings that can appear due to
// multiple test suites attaching process-level listeners in parallel.
// This does not mask real errors; it simply raises the limit.
// See: https://nodejs.org/api/events.html#emittersetmaxlistenersn
process.setMaxListeners(64)

beforeEach(() => {
  // Reset any global state if needed
  vi.resetAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(() => {
  // Cleanup after each test
})

// Export any shared test utilities
export {}
