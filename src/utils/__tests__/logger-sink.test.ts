import { describe, it, expect, beforeEach } from 'vitest'

import type { LogEntry } from '#utils/logger'

import { createLogger, registerSink, clearSinks } from '#utils/logger'

describe('logger custom sink', () => {
  let entries: Array<LogEntry>

  beforeEach(() => {
    entries = []
    clearSinks()
    registerSink((e) => entries.push(e))
  })

  it('forwards log entries to registered sinks', () => {
    const logger = createLogger('test:sink')
    logger.info('hello', { a: 1 })

    expect(entries.length).toBe(1)
    expect(entries[0]?.component).toBe('test:sink')
    expect(entries[0]?.msg).toBe('hello')
    expect(entries[0]?.context).toEqual({ a: 1 })
  })
})
