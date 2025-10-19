import '@testing-library/jest-dom'

// Reset mocks between tests
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  // place for cleanup if needed
})
