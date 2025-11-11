/**
 * Schema Assertion Utilities (CI-T04-AC04)
 *
 * Wrapper utilities around Zod for schema validation in tests.
 * Provides readable error messages and convenient assertion helpers.
 */

import { expect } from 'vitest'
import { ZodError } from 'zod'

import {
  MessageSchema,
  type Message,
  type TextMessage,
  type MediaMessage,
  type TapbackMessage,
  type NotificationMessage,
} from '../../src/schema/message'

// ============================================================================
// Core Validation Helpers
// ============================================================================

/**
 * Validates a message against the Message schema
 *
 * @param message - Message to validate
 * @returns Validation result with typed data or errors
 *
 * @example
 * const result = validateMessage(msg)
 * if (!result.success) {
 *   console.error(result.errors)
 * }
 */
export function validateMessage(message: unknown): {
  success: boolean
  data?: Message
  errors?: string[]
} {
  try {
    const validated = MessageSchema.parse(message)
    return {
      success: true,
      data: validated,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        ),
      }
    }
    return {
      success: false,
      errors: ['Unknown validation error'],
    }
  }
}

/**
 * Validates an array of messages, returning all validation errors
 *
 * @param messages - Array of messages to validate
 * @returns Validation results for each message
 *
 * @example
 * const results = validateMessages(messages)
 * const failed = results.filter(r => !r.success)
 * console.log(`${failed.length} messages failed validation`)
 */
export function validateMessages(messages: unknown[]): Array<{
  index: number
  success: boolean
  data?: Message
  errors?: string[]
}> {
  return messages.map((msg, index) => ({
    index,
    ...validateMessage(msg),
  }))
}

// ============================================================================
// Vitest Assertion Helpers
// ============================================================================

/**
 * Asserts that a value is a valid Message according to the schema
 *
 * @param message - Value to validate
 * @throws Assertion error if validation fails
 *
 * @example
 * assertValidMessage(msg) // Throws if invalid
 * // Test passes, msg is now typed as Message
 */
export function assertValidMessage(
  message: unknown,
): asserts message is Message {
  const result = validateMessage(message)
  if (!result.success) {
    expect.fail(
      `Message validation failed:\n  - ${result.errors?.join('\n  - ')}`,
    )
  }
}

/**
 * Asserts that all messages in an array are valid
 *
 * @param messages - Array of messages to validate
 * @throws Assertion error if any validation fails
 *
 * @example
 * assertValidMessages(messages)
 * // All messages are now typed as Message[]
 */
export function assertValidMessages(
  messages: unknown[],
): asserts messages is Message[] {
  const results = validateMessages(messages)
  const failed = results.filter((r) => !r.success)

  if (failed.length > 0) {
    const errorReport = failed
      .map((r) => `  Message ${r.index}:\n    - ${r.errors?.join('\n    - ')}`)
      .join('\n')
    expect.fail(
      `${failed.length} message(s) failed validation:\n${errorReport}`,
    )
  }
}

/**
 * Expects a message to be invalid and optionally checks for specific error
 *
 * @param message - Message expected to be invalid
 * @param expectedError - Optional regex to match against error message
 *
 * @example
 * expectInvalidMessage({ guid: '', text: '' }) // Expects validation to fail
 * expectInvalidMessage(badMsg, /ISO 8601/) // Expects date format error
 */
export function expectInvalidMessage(message: unknown, expectedError?: RegExp) {
  const result = validateMessage(message)

  expect(result.success).toBe(false)

  if (expectedError && result.errors) {
    const allErrors = result.errors.join(' ')
    expect(allErrors).toMatch(expectedError)
  }
}

// ============================================================================
// Message Kind Type Guards with Assertions
// ============================================================================

/**
 * Asserts that a message is a text message
 *
 * @param message - Message to check
 * @throws Assertion error if not text message
 *
 * @example
 * assertTextMessage(msg)
 * console.log(msg.text) // TypeScript knows msg.text exists
 */
export function assertTextMessage(
  message: Message,
): asserts message is TextMessage {
  expect(message.messageKind).toBe('text')
}

/**
 * Asserts that a message is a media message
 *
 * @param message - Message to check
 * @throws Assertion error if not media message
 *
 * @example
 * assertMediaMessage(msg)
 * console.log(msg.media.filename) // TypeScript knows msg.media exists
 */
export function assertMediaMessage(
  message: Message,
): asserts message is MediaMessage {
  expect(message.messageKind).toBe('media')
  expect(message.media).toBeDefined()
}

/**
 * Asserts that a message is a tapback message
 *
 * @param message - Message to check
 * @throws Assertion error if not tapback message
 *
 * @example
 * assertTapbackMessage(msg)
 * console.log(msg.tapback.tapbackKind) // TypeScript knows msg.tapback exists
 */
export function assertTapbackMessage(
  message: Message,
): asserts message is TapbackMessage {
  expect(message.messageKind).toBe('tapback')
  expect(message.tapback).toBeDefined()
}

/**
 * Asserts that a message is a notification message
 *
 * @param message - Message to check
 * @throws Assertion error if not notification message
 *
 * @example
 * assertNotificationMessage(msg)
 * console.log(msg.notificationText) // TypeScript knows field exists
 */
export function assertNotificationMessage(
  message: Message,
): asserts message is NotificationMessage {
  expect(message.messageKind).toBe('notification')
}

// ============================================================================
// Field-Specific Assertions
// ============================================================================

/**
 * Asserts that a date string is valid ISO 8601 with Z suffix
 *
 * @param dateString - Date string to validate
 * @param fieldName - Name of field for error messages
 *
 * @example
 * assertValidISO8601(msg.date, 'date')
 */
export function assertValidISO8601(
  dateString: string,
  fieldName: string = 'date',
) {
  expect(dateString, `${fieldName} should be defined`).toBeDefined()
  expect(dateString, `${fieldName} should match ISO 8601 format`).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  )
  const parsed = new Date(dateString)
  expect(parsed.toString(), `${fieldName} should be valid date`).not.toBe(
    'Invalid Date',
  )
}

/**
 * Asserts that a GUID has the expected format
 *
 * @param guid - GUID to validate
 * @param expectedPrefix - Optional expected prefix (e.g., 'csv:', 'db:')
 *
 * @example
 * assertValidGuid(msg.guid)
 * assertValidGuid(msg.guid, 'csv:') // Expects CSV source
 */
export function assertValidGuid(guid: string, expectedPrefix?: string) {
  expect(guid, 'GUID should be defined').toBeDefined()
  expect(guid.length, 'GUID should not be empty').toBeGreaterThan(0)

  if (expectedPrefix) {
    expect(guid, `GUID should start with ${expectedPrefix}`).toMatch(
      new RegExp(`^${expectedPrefix}`),
    )
  }
}

/**
 * Asserts that a media path is absolute when file exists
 *
 * @param path - Path to validate
 *
 * @example
 * assertAbsolutePath(msg.media.path)
 */
export function assertAbsolutePath(path: string) {
  expect(path, 'Path should be defined').toBeDefined()
  expect(path, 'Path should be absolute').toMatch(/^\//)
}

/**
 * Assert message has specific enrichment
 *
 * @param enrichments - Enrichments to check
 * @param kind - Expected enrichment kind
 *
 * @example
 * assertHasEnrichment(msg.media.enrichment, 'image_analysis')
 */
export function assertHasEnrichment(
  enrichments: Array<Record<string, unknown>> | undefined,
  kind: string,
) {
  expect(enrichments, 'Enrichment array should exist').toBeDefined()
  expect(Array.isArray(enrichments), 'Enrichment should be array').toBe(true)

  const hasKind = enrichments?.some((e) => e.kind === kind)
  expect(hasKind, `Should have enrichment of kind: ${kind}`).toBe(true)
}

// ============================================================================
// Bulk Validation Helpers
// ============================================================================

/**
 * Validates messages and returns statistics
 *
 * @param messages - Messages to validate
 * @returns Validation statistics
 *
 * @example
 * const stats = getValidationStats(messages)
 * console.log(`${stats.validCount}/${stats.totalCount} valid`)
 * console.log(`Breakdown: ${stats.byKind.text} text, ${stats.byKind.media} media`)
 */
export function getValidationStats(messages: unknown[]) {
  const results = validateMessages(messages)
  const valid = results.filter((r) => r.success)
  const invalid = results.filter((r) => !r.success)

  const byKind = valid.reduce(
    (acc, r) => {
      const kind = r.data?.messageKind || 'unknown'
      acc[kind] = (acc[kind] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return {
    totalCount: messages.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    byKind,
    invalidMessages: invalid.map((r) => ({
      index: r.index,
      errors: r.errors,
    })),
  }
}

/**
 * Asserts minimum validation success rate
 *
 * @param messages - Messages to validate
 * @param minSuccessRate - Minimum success rate (0-1)
 *
 * @example
 * assertValidationRate(messages, 0.95) // Expects 95%+ valid
 */
export function assertValidationRate(
  messages: unknown[],
  minSuccessRate: number,
) {
  const stats = getValidationStats(messages)
  const actualRate = stats.validCount / stats.totalCount

  expect(
    actualRate,
    `Validation rate ${(actualRate * 100).toFixed(1)}% is below minimum ${(minSuccessRate * 100).toFixed(1)}%\n` +
      `  Valid: ${stats.validCount}/${stats.totalCount}\n` +
      `  Errors in messages: ${stats.invalidMessages.map((m) => m.index).join(', ')}`,
  ).toBeGreaterThanOrEqual(minSuccessRate)
}
