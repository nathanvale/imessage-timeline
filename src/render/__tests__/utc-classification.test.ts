import { describe, expect, it } from 'vitest'

import { classifyTimeOfDay, extractDate, sortByTimestamp } from '../grouping'

interface TestCase {
	label: string
	iso: string
	expected: 'morning' | 'afternoon' | 'evening'
}

describe('UTC normalization and time-of-day classification', () => {
	it('treats timezone-less timestamps as UTC for date extraction', () => {
		// No trailing Z – should be coerced to UTC and date extracted in UTC
		const iso = '2025-10-17T10:00:00'
		expect(extractDate(iso)).toBe('2025-10-17')

		// With explicit Z, result should be identical
		const isoZ = '2025-10-17T10:00:00Z'
		expect(extractDate(isoZ)).toBe('2025-10-17')
	})

	it('classifies time-of-day boundaries correctly in UTC', () => {
		const cases: Array<TestCase> = [
			{ label: '00:00', iso: '2025-01-01T00:00:00', expected: 'morning' },
			{
				label: '11:59:59.999',
				iso: '2025-01-01T11:59:59.999',
				expected: 'morning',
			},
			{ label: '12:00', iso: '2025-01-01T12:00:00', expected: 'afternoon' },
			{
				label: '17:59:59.999',
				iso: '2025-01-01T17:59:59.999',
				expected: 'afternoon',
			},
			{ label: '18:00', iso: '2025-01-01T18:00:00', expected: 'evening' },
			{
				label: '23:59:59.999',
				iso: '2025-01-01T23:59:59.999',
				expected: 'evening',
			},
		]

		for (const c of cases) {
			// Without Z should be treated as UTC
			expect(classifyTimeOfDay(c.iso), `${c.label} no Z`).toBe(c.expected)
			// With Z should match exactly
			expect(classifyTimeOfDay(`${c.iso}Z`), `${c.label} with Z`).toBe(c.expected)
		}
	})

	it('sorts consistently when timestamps lack timezone', () => {
		const messages = [
			{ id: 'b', date: '2025-10-17T10:00:01' },
			{ id: 'a', date: '2025-10-17T10:00:00' },
			{ id: 'c', date: '2025-10-17T10:00:02Z' },
		] as Array<{ id: string; date: string }>

		const sorted = sortByTimestamp(messages)
		expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c'])
	})
})
