import { describe, it, expect } from 'vitest'

// Simple unit test for createGreeting to avoid process spawning in CI smoke
import { createGreeting, isCi } from '../index.js'

describe('library surface', () => {
  it('createGreeting returns a friendly message', () => {
    expect(createGreeting('Spec')).toBe('Hello, Spec!')
  })

  it('isCi detects CI env', () => {
    expect(isCi({ CI: '1' } as NodeJS.ProcessEnv)).toBe(true)
    expect(isCi({} as NodeJS.ProcessEnv)).toBe(false)
  })
})
