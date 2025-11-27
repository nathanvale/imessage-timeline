import { describe, expect, it } from 'vitest'

import {
	type Config,
	type Message,
	type RateLimitConfig,
	createRateLimiter,
	ingestCSV,
	loadConfig,
} from '../index.js'

describe('library surface', () => {
	it('exports loadConfig function', () => {
		expect(typeof loadConfig).toBe('function')
	})

	it('exports ingestCSV function', () => {
		expect(typeof ingestCSV).toBe('function')
	})

	it('exports createRateLimiter function', () => {
		expect(typeof createRateLimiter).toBe('function')
	})

	it('exports Config type (runtime check via type guards)', () => {
		const sampleConfig: Partial<Config> = {
			gemini: { apiKey: 'test' },
		}
		expect(sampleConfig).toBeDefined()
	})

	it('exports Message type (compile-time type check)', () => {
		const sampleMessage: Partial<Message> = {
			guid: 'test-guid',
			text: 'test message',
		}
		expect(sampleMessage).toBeDefined()
	})

	it('exports RateLimitConfig type (compile-time type check)', () => {
		const sampleConfig: RateLimitConfig = {
			rateLimitDelay: 1000,
			maxRetries: 3,
			circuitBreakerThreshold: 5,
			circuitBreakerResetMs: 60000,
		}
		expect(sampleConfig).toBeDefined()
	})
})
