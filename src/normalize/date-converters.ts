// src/normalize/date-converters.ts
// Apple epoch and CSV UTC converters with end-to-end validation
// Spec §13: Dates & Timezones, Risks & Mitigations

/**
 * Apple epoch constant: seconds since 2001-01-01 00:00:00 UTC
 * Used by macOS for timestamps
 */
const APPLE_EPOCH_SECONDS = 978_307_200

/**
 * AC02: Convert Apple epoch (seconds since 2001-01-01 UTC) to ISO 8601 UTC string
 * @param appleEpochSeconds - Seconds since 2001-01-01 00:00:00 UTC (may have fractional part)
 * @returns ISO 8601 UTC string with Z suffix (e.g., "2001-01-01T00:00:00.000Z")
 */
export function convertAppleEpochToUTC(appleEpochSeconds: number): string {
  // Convert Apple epoch seconds to Unix epoch milliseconds
  const unixMs = (appleEpochSeconds + APPLE_EPOCH_SECONDS) * 1000

  // Create date and convert to ISO 8601 UTC
  const date = new Date(unixMs)
  return date.toISOString()
}

/**
 * AC01 & AC03: Normalize CSV UTC timestamp to ISO 8601 with Z suffix
 * Preserves timezone information and ensures consistent format
 * @param csvDate - CSV timestamp (typically already UTC with Z suffix)
 * @returns Normalized ISO 8601 UTC string with Z suffix
 */
export function normalizeCSVDate(csvDate: string): string {
  // Parse the CSV date string
  const date = new Date(csvDate)

  // Check if parse was successful
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid CSV date format: ${csvDate}`)
  }

  // Return ISO 8601 UTC string with Z suffix
  return date.toISOString()
}

/**
 * AC01: Validate date format is ISO 8601 UTC with Z suffix
 * Strict validation rejects malformed dates and non-UTC timezones
 * @param dateString - Date string to validate
 * @returns Object with valid flag and optional error message
 */
export function validateDateFormat(
  dateString: string
): { valid: boolean; error?: string } {
  // Check if empty or whitespace
  if (!dateString || typeof dateString !== 'string' || !dateString.trim()) {
    return { valid: false, error: 'Date string is empty or whitespace' }
  }

  // Check for Z suffix
  if (!dateString.endsWith('Z')) {
    return { valid: false, error: 'Date must end with Z suffix (UTC)' }
  }

  // Check for timezone offset (should not be present)
  if (dateString.includes('+') || dateString.match(/-\d{2}:\d{2}$/)) {
    return { valid: false, error: 'Date must be UTC only (no timezone offset)' }
  }

  // ISO 8601 requires T separator, not space
  if (dateString.includes(' ')) {
    return {
      valid: false,
      error: 'Date must use T separator (ISO 8601), not space',
    }
  }

  // Strict ISO 8601 format check: YYYY-MM-DDTHH:mm:ss.sssZ
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
  if (!iso8601Regex.test(dateString)) {
    return {
      valid: false,
      error: 'Date must match ISO 8601 format (YYYY-MM-DDTHH:mm:ss[.sss]Z)',
    }
  }

  // Attempt to parse
  const date = new Date(dateString)

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid ISO 8601 date format' }
  }

  // Validate the date is actually valid (e.g., Feb 29 in non-leap year)
  // Re-stringify and compare to ensure components match
  const isoString = date.toISOString()

  // Extract components from original and reformed
  const originalParts = dateString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )
  const reformedParts = isoString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )

  if (!originalParts || !reformedParts) {
    return { valid: false, error: 'Failed to parse date components' }
  }

  // Check year, month, day, hour, minute, second match
  // If they don't match, it means the date was invalid (like Feb 30)
  for (let i = 1; i <= 6; i++) {
    if (originalParts[i] !== reformedParts[i]) {
      return {
        valid: false,
        error: `Invalid date values: component mismatch at index ${i}`,
      }
    }
  }

  return { valid: true }
}

/**
 * AC04: Detect timezone drift between two timestamps
 * Returns true if timestamps differ by more than a reasonable margin
 * @param original - Original timestamp
 * @param converted - Converted/processed timestamp
 * @returns true if drift detected (timestamps differ significantly)
 */
export function detectTimezoneDrift(original: string, converted: string): boolean {
  const origTime = new Date(original).getTime()
  const convTime = new Date(converted).getTime()

  // Allow 1 second tolerance for rounding/processing differences
  const toleranceMs = 1000
  const diffMs = Math.abs(origTime - convTime)

  return diffMs > toleranceMs
}

/**
 * AC04: End-to-end round-trip validation
 * Validates that a date can be parsed, normalized, and validated without drift
 * @param dateString - Input date string
 * @returns Validation result with drift detection
 */
export function roundTripDateValidation(dateString: string): {
  valid: boolean
  driftDetected: boolean
  input: string
  normalized: string
  error?: string
} {
  try {
    // Step 1: Validate original format
    const formatValidation = validateDateFormat(dateString)
    if (!formatValidation.valid) {
      return {
        valid: false,
        driftDetected: false,
        input: dateString,
        normalized: '',
        error: formatValidation.error,
      }
    }

    // Step 2: Normalize (re-parse to ensure consistent formatting)
    const normalized = normalizeCSVDate(dateString)

    // Step 3: Validate normalized format
    const normalizedValidation = validateDateFormat(normalized)
    if (!normalizedValidation.valid) {
      return {
        valid: false,
        driftDetected: false,
        input: dateString,
        normalized,
        error: `Normalized date failed validation: ${normalizedValidation.error}`,
      }
    }

    // Step 4: Detect drift
    const driftDetected = detectTimezoneDrift(dateString, normalized)

    return {
      valid: true,
      driftDetected,
      input: dateString,
      normalized,
    }
  } catch (error) {
    return {
      valid: false,
      driftDetected: false,
      input: dateString,
      normalized: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
