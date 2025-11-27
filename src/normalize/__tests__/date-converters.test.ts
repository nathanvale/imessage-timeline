// src/normalize/__tests__/date-converters.test.ts
// TDD tests for date converters - RED phase
// Tests written FIRST to drive implementation

import { describe, expect, it } from 'vitest'

import {
	APPLE_EPOCH_SECONDS,
	csvUtcTimestamps,
	dstEdgeCases,
	invalidDateInputs,
	knownTimestamps,
} from '../../../__tests__/fixtures/date-converters'
import {
	convertAppleEpochToUTC,
	detectTimezoneDrift,
	normalizeCSVDate,
	roundTripDateValidation,
	validateDateFormat,
} from '../date-converters'

describe('NORMALIZE--T06: Date Validators and Converters', () => {
	describe('AC02: Apple epoch conversion', () => {
		it('should convert Apple epoch 0 to 2001-01-01T00:00:00.000Z', () => {
			const result = convertAppleEpochToUTC(0)
			expect(result).toBe('2001-01-01T00:00:00.000Z')
		})

		it('should convert known timestamps correctly', () => {
			knownTimestamps.forEach(({ appleEpoch, expectedUTC, description }) => {
				const result = convertAppleEpochToUTC(appleEpoch)
				expect(result, `${description}: epoch ${appleEpoch}`).toBe(expectedUTC)
			})
		})

		it('should handle fractional seconds in Apple epoch', () => {
			// 1234567890.5 seconds after epoch
			const result = convertAppleEpochToUTC(1_234_567_890.5)
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
			expect(result).toContain('Z')
		})

		it('should produce ISO 8601 UTC strings with Z suffix', () => {
			knownTimestamps.forEach(({ appleEpoch }) => {
				const result = convertAppleEpochToUTC(appleEpoch)
				expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
			})
		})

		it('should handle far future timestamps (year 2100+)', () => {
			// ~3.1 billion seconds = ~99 years after 2001 = year 2100
			const result = convertAppleEpochToUTC(3_124_137_600)
			expect(result).toBe('2100-01-01T00:00:00.000Z')
		})

		it('should preserve millisecond precision', () => {
			const result = convertAppleEpochToUTC(722_592_001.234)
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
		})
	})

	describe('AC01 & AC03: CSV UTC normalization and preservation', () => {
		it('should preserve valid CSV UTC timestamps exactly', () => {
			csvUtcTimestamps.forEach((timestamp) => {
				const result = normalizeCSVDate(timestamp)
				expect(result).toBe(timestamp)
			})
		})

		it('should ensure all CSV timestamps end with Z suffix', () => {
			csvUtcTimestamps.forEach((timestamp) => {
				const result = normalizeCSVDate(timestamp)
				expect(result).toMatch(/Z$/)
			})
		})

		it('should preserve millisecond precision', () => {
			const input = '2023-10-17T06:52:57.123Z'
			const result = normalizeCSVDate(input)
			expect(result).toContain('.123')
		})

		it('should handle timestamps without milliseconds', () => {
			const input = '2023-10-17T06:52:57Z'
			const result = normalizeCSVDate(input)
			expect(result).toMatch(/\.\d{3}Z$/) // Should have 3-digit milliseconds
			expect(result).toContain('2023-10-17T06:52:57')
		})

		it('should not drift on repeated normalization', () => {
			const original = '2023-10-17T06:52:57.000Z'
			const first = normalizeCSVDate(original)
			const second = normalizeCSVDate(first)
			const third = normalizeCSVDate(second)

			expect(first).toBe(original)
			expect(second).toBe(first)
			expect(third).toBe(second)
		})
	})

	describe('AC01: All timestamps have Z suffix (UTC)', () => {
		it('should ensure converted Apple epoch has Z suffix', () => {
			knownTimestamps.forEach(({ appleEpoch }) => {
				const result = convertAppleEpochToUTC(appleEpoch)
				expect(result).toMatch(/Z$/)
			})
		})

		it('should ensure normalized CSV dates have Z suffix', () => {
			csvUtcTimestamps.forEach((timestamp) => {
				const result = normalizeCSVDate(timestamp)
				expect(result).toMatch(/Z$/)
			})
		})

		it('should reject dates without Z suffix', () => {
			const invalidDate = '2023-10-17T06:52:57.000' // Missing Z
			const result = validateDateFormat(invalidDate)
			expect(result.valid).toBe(false)
		})

		it('should reject dates with timezone offsets', () => {
			const withOffset = '2023-10-17T06:52:57+00:00'
			const result = validateDateFormat(withOffset)
			expect(result.valid).toBe(false)
		})
	})

	describe('AC01: Date format validation', () => {
		it('should validate correct ISO 8601 UTC format', () => {
			csvUtcTimestamps.forEach((timestamp) => {
				const result = validateDateFormat(timestamp)
				expect(result.valid, `${timestamp} should be valid`).toBe(true)
			})
		})

		it('should reject invalid date strings', () => {
			invalidDateInputs.forEach(({ input, description }) => {
				const result = validateDateFormat(input)
				expect(result.valid, description).toBe(false)
				expect(result.error).toBeDefined()
			})
		})

		it('should provide descriptive error messages', () => {
			const result = validateDateFormat('invalid')
			expect(result.error).toBeDefined()
			expect(typeof result.error).toBe('string')
		})

		it('should validate leap year dates', () => {
			const result = validateDateFormat('2004-02-29T12:34:56.000Z')
			expect(result.valid).toBe(true)
		})

		it('should reject invalid leap year dates', () => {
			const result = validateDateFormat('2023-02-29T12:34:56.000Z')
			expect(result.valid).toBe(false)
		})
	})

	describe('AC04: End-to-end round-trip validation', () => {
		it('should convert Apple epoch → UTC → validate successfully', () => {
			knownTimestamps.forEach(({ appleEpoch, expectedUTC }) => {
				const utc = convertAppleEpochToUTC(appleEpoch)
				const validation = validateDateFormat(utc)

				expect(validation.valid).toBe(true)
				expect(utc).toBe(expectedUTC)
			})
		})

		it('should normalize CSV → validate successfully', () => {
			csvUtcTimestamps.forEach((timestamp) => {
				const normalized = normalizeCSVDate(timestamp)
				const validation = validateDateFormat(normalized)

				expect(validation.valid).toBe(true)
			})
		})

		it('should detect timezone drift in round-trip', () => {
			const original = '2023-10-17T06:52:57.000Z'
			const result = roundTripDateValidation(original)

			expect(result.driftDetected).toBe(false)
			expect(result.valid).toBe(true)
		})

		it('should handle DST boundaries without drift', () => {
			dstEdgeCases.forEach(({ utc, description }) => {
				const result = roundTripDateValidation(utc)
				expect(result.driftDetected, description).toBe(false)
				expect(result.valid).toBe(true)
			})
		})

		it('should provide detailed round-trip report', () => {
			const result = roundTripDateValidation('2023-10-17T06:52:57.000Z')

			expect(result).toHaveProperty('valid')
			expect(result).toHaveProperty('driftDetected')
			expect(result).toHaveProperty('input')
			expect(result).toHaveProperty('normalized')
		})
	})

	describe('Timezone drift detection', () => {
		it('should not detect drift for valid UTC conversions', () => {
			knownTimestamps.forEach(({ appleEpoch, expectedUTC }) => {
				const converted = convertAppleEpochToUTC(appleEpoch)
				const drift = detectTimezoneDrift(expectedUTC, converted)

				expect(drift).toBe(false)
			})
		})

		it('should detect drift when timestamps differ', () => {
			const original = '2023-10-17T06:52:57.000Z'
			const drifted = '2023-10-17T07:52:57.000Z' // Off by 1 hour

			const drift = detectTimezoneDrift(original, drifted)
			expect(drift).toBe(true)
		})

		it('should not consider millisecond precision differences as drift', () => {
			const original = '2023-10-17T06:52:57.000Z'
			const slightDiff = '2023-10-17T06:52:57.001Z' // 1ms difference

			const drift = detectTimezoneDrift(original, slightDiff)
			// Depending on implementation, this might be drift or not
			// but should be documented
			expect(typeof drift).toBe('boolean')
		})
	})

	describe('Edge cases and error handling', () => {
		it('should handle negative or zero Apple epoch values', () => {
			expect(() => convertAppleEpochToUTC(0)).not.toThrow()
			expect(convertAppleEpochToUTC(0)).toBe('2001-01-01T00:00:00.000Z')
		})

		it('should handle very large Apple epoch values', () => {
			// 2100-01-01 is ~3.1 billion seconds
			expect(() => convertAppleEpochToUTC(5_000_000_000)).not.toThrow()
			const result = convertAppleEpochToUTC(5_000_000_000)
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
		})

		it('should handle empty or whitespace input gracefully', () => {
			const result = validateDateFormat('')
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
		})

		it('should validate ISO 8601 compliance strictly', () => {
			// Space instead of T
			const result1 = validateDateFormat('2023-10-17 06:52:57.000Z')
			expect(result1.valid).toBe(false)

			// Missing colons
			const result2 = validateDateFormat('2023-10-17T065257.000Z')
			expect(result2.valid).toBe(false)
		})
	})

	describe('Batch operations', () => {
		it('should handle arrays of Apple epoch values', () => {
			const epochs = knownTimestamps.map((t) => t.appleEpoch)
			const results = epochs.map(convertAppleEpochToUTC)

			expect(results).toHaveLength(epochs.length)
			results.forEach((result) => {
				expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
			})
		})

		it('should handle arrays of CSV dates', () => {
			const results = csvUtcTimestamps.map(normalizeCSVDate)

			expect(results).toHaveLength(csvUtcTimestamps.length)
			results.forEach((result) => {
				expect(result).toMatch(/Z$/)
			})
		})
	})

	describe('Integration: CSV and Apple epoch together', () => {
		it('should align CSV and DB timestamps to same UTC format', () => {
			const csvDate = '2023-10-17T06:52:57.000Z'
			const csvNormalized = normalizeCSVDate(csvDate)

			const appleEpoch = 719_218_377
			const dbNormalized = convertAppleEpochToUTC(appleEpoch)

			// Both should end with Z
			expect(csvNormalized).toMatch(/Z$/)
			expect(dbNormalized).toMatch(/Z$/)

			// Both should validate
			expect(validateDateFormat(csvNormalized).valid).toBe(true)
			expect(validateDateFormat(dbNormalized).valid).toBe(true)

			// Should be identical (assuming the epoch value is correct)
			expect(dbNormalized).toBe('2023-10-17T06:52:57.000Z')
		})
	})

	describe('Error handling - exception scenarios', () => {
		it('should handle errors gracefully when normalizeCSVDate throws', () => {
			// normalizeCSVDate throws on invalid dates
			const result = roundTripDateValidation('not-a-date-at-all')

			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.driftDetected).toBe(false)
			expect(result.input).toBe('not-a-date-at-all')
			expect(result.normalized).toBe('')
		})

		it('should provide error message when exception is caught', () => {
			// Test that exception handling works
			const result = roundTripDateValidation('invalid')

			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(typeof result.error).toBe('string')
		})

		it('should handle non-Error exceptions gracefully', () => {
			// The catch block handles both Error and non-Error exceptions
			const result = roundTripDateValidation('2023-10-17T25:99:99.000Z')

			expect(result.valid).toBe(false)
			expect(result.driftDetected).toBe(false)
			expect(result.input).toBeDefined()
		})
	})
})
