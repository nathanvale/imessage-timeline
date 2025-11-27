// __tests__/fixtures/date-converters.ts
// Known timestamp pairs for date converter testing
// Apple epoch is seconds since 2001-01-01 00:00:00 UTC

/**
 * Known timestamp pairs: { appleEpoch, expectedUTC, description }
 * Used to verify bidirectional conversion correctness
 * Calculated as: unixSeconds - APPLE_EPOCH_SECONDS (978_307_200)
 */
export const knownTimestamps = [
	// Apple epoch start: 2001-01-01T00:00:00Z (epoch = 0)
	{
		appleEpoch: 0,
		expectedUTC: '2001-01-01T00:00:00.000Z',
		description: 'Apple epoch origin (2001-01-01)',
	},
	// Known timestamp: 2023-10-17T06:52:57.000Z (used in refactor report)
	{
		appleEpoch: 719_218_377,
		expectedUTC: '2023-10-17T06:52:57.000Z',
		description: 'Example message timestamp from pipeline',
	},
	// Leap year: 2004-02-29T12:34:56Z
	{
		appleEpoch: 99_750_896,
		expectedUTC: '2004-02-29T12:34:56.000Z',
		description: 'Leap year date (Feb 29)',
	},
	// DST boundary: 2023-03-12T02:00:00Z (spring forward)
	{
		appleEpoch: 700_279_200,
		expectedUTC: '2023-03-12T02:00:00.000Z',
		description: 'DST spring forward boundary',
	},
	// DST boundary: 2023-11-05T02:00:00Z (fall back)
	{
		appleEpoch: 720_842_400,
		expectedUTC: '2023-11-05T02:00:00.000Z',
		description: 'DST fall back boundary',
	},
	// Year 2001-12-31T23:59:59Z (end of Apple epoch first year)
	{
		appleEpoch: 31_535_999,
		expectedUTC: '2001-12-31T23:59:59.000Z',
		description: 'End of Apple epoch first year',
	},
	// Far future: year 2100-01-01T00:00:00Z
	{
		appleEpoch: 3_124_137_600,
		expectedUTC: '2100-01-01T00:00:00.000Z',
		description: 'Far future (year 2100)',
	},
]

/**
 * CSV UTC timestamps that should be preserved exactly
 */
export const csvUtcTimestamps = [
	'2023-10-17T06:52:57.000Z',
	'2001-01-01T00:00:00.000Z',
	'2023-03-12T02:00:00.000Z',
	'2023-11-05T02:00:00.000Z',
	'2004-02-29T12:34:56.123Z',
	'2050-06-15T14:30:45.999Z',
]

/**
 * Invalid date inputs for error handling
 */
export const invalidDateInputs = [
	{ input: 'not-a-date', description: 'Non-date string' },
	{ input: '', description: 'Empty string' },
	{ input: '2023-10-17', description: 'Date only, no time' },
	{ input: '2023-13-01T00:00:00Z', description: 'Invalid month (13)' },
	{ input: '2023-02-30T00:00:00Z', description: 'Invalid day (Feb 30)' },
	{ input: '2023-10-17T25:00:00Z', description: 'Invalid hour (25)' },
	{ input: 'NaN', description: 'String "NaN"' },
]

/**
 * DST edge cases for timezone drift detection
 */
export const dstEdgeCases = [
	// 2023-03-12T02:00:00 UTC (spring forward in many timezones)
	{
		utc: '2023-03-12T02:00:00.000Z',
		description: 'Spring forward (2:00 AM becomes 3:00 AM in US Eastern)',
	},
	// 2023-11-05T02:00:00 UTC (fall back in many timezones)
	{
		utc: '2023-11-05T02:00:00.000Z',
		description: 'Fall back (2:00 AM happens twice in US Eastern)',
	},
	// Pre-DST
	{
		utc: '2023-03-11T23:59:59.000Z',
		description: 'Just before spring forward',
	},
	// Post-DST
	{
		utc: '2023-11-05T07:00:00.000Z',
		description: 'After fall back transition completes',
	},
]

/**
 * Expected Apple epoch constants
 */
export const APPLE_EPOCH_SECONDS = 978_307_200 // 2001-01-01 00:00:00 UTC in Unix seconds
export const APPLE_EPOCH_MS = APPLE_EPOCH_SECONDS * 1000
