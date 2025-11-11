import { describe, it, expect, beforeEach } from 'vitest'

import type { LogEntry } from '#utils/logger'

import {
  createLogger,
  setCorrelationId,
  getCorrelationId,
  withCorrelationId,
  registerSink,
  clearSinks,
} from '#utils/logger'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('logger correlationId', () => {
  let entries: Array<LogEntry>

  beforeEach(() => {
    entries = []
    clearSinks()
    setCorrelationId(undefined)
    registerSink((e) => entries.push(e))
  })

  it('does not include correlationId by default', () => {
    const logger = createLogger('test:default')
    logger.info('hello')

    expect(entries.length).toBe(1)
    expect(entries[0]?.correlationId).toBeUndefined()
  })

  it('includes correlationId when set via setCorrelationId', () => {
    const logger = createLogger('test:set')
    setCorrelationId('abc123')
    logger.info('hello')

    expect(entries.length).toBe(1)
    expect(entries[0]?.correlationId).toBe('abc123')
    expect(getCorrelationId()).toBe('abc123')
  })

  it('withCorrelationId sets and restores correlationId', async () => {
    const logger = createLogger('test:with')

    setCorrelationId('outer')
    await withCorrelationId('inner', async () => {
      logger.info('inside')
    })
    logger.info('outside')

    expect(entries.length).toBe(2)
    const [inside, outside] = entries
    expect(inside?.correlationId).toBe('inner')
    expect(outside?.correlationId).toBe('outer')
  })

  it('isolates correlationId across concurrent async contexts', async () => {
    const logger = createLogger('test:concurrent')

    await Promise.all([
      withCorrelationId('A', async () => {
        logger.info('from A-1')
        await delay(5)
        logger.info('from A-2')
      }),
      withCorrelationId('B', async () => {
        await delay(1)
        logger.info('from B-1')
        await delay(1)
        logger.info('from B-2')
      }),
    ])

    // All entries should be tagged with either A or B
    const ids = new Set(entries.map((e) => e.correlationId))
    expect(ids.has('A')).toBe(true)
    expect(ids.has('B')).toBe(true)
    expect(ids.size).toBe(2)
  })
})
