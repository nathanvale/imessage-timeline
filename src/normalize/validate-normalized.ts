// src/normalize/validate-normalized.ts
// Zod validation layer for normalized messages
// Spec §4.3, §9: Schema validation with comprehensive error reporting

import { Message, MessageSchema } from '../schema/message'

export interface ValidationError {
  index: number
  fieldPath: string
  message: string
}

/**
 * AC01: Validate all normalized messages against MessageSchema
 * AC02: Include field paths in error messages
 * AC03: Batch validation - collect all errors before throwing
 * @param messages - Array of messages to validate
 * @returns Array of validated messages if all pass
 * @throws Error with formatted error messages if any validation fails
 */
export function validateNormalizedMessages(messages: unknown[]): Message[] {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array')
  }

  const validatedMessages: Message[] = []
  const errors: ValidationError[] = []

  // Process each message and collect errors (AC03: no fail-fast)
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    // AC04: Check for snake_case fields before schema validation
    if (typeof message === 'object' && message !== null && hasSnakeCaseFields(message)) {
      const snakeCaseFields = getSnakeCaseFields(message)
      const fieldList = snakeCaseFields.join(', ')
      errors.push({
        index: i,
        fieldPath: 'root',
        message: `Message contains snake_case fields: ${fieldList}. Use camelCase instead.`,
      })
      continue
    }

    // Validate against schema
    const result = MessageSchema.safeParse(message)

    if (!result.success) {
      // AC02: Format Zod errors with field paths
      const formattedErrors = formatValidationErrors(i, result.error.errors)
      errors.push({
        index: i,
        fieldPath: 'multiple',
        message: formattedErrors,
      })
    } else {
      validatedMessages.push(result.data)
    }
  }

  // If any errors occurred, throw with all collected errors (AC03)
  if (errors.length > 0) {
    const errorSummary = errors.map((e) => `messages.${e.index}: ${e.message}`).join('\n')
    const error = new Error(`Validation failed:\n${errorSummary}`)
    error.name = 'ValidationError'
    throw error
  }

  return validatedMessages
}

/**
 * AC02: Format Zod validation errors with field paths
 * Converts Zod error array into readable messages with paths
 * @param messageIndex - Index of the message in the array
 * @param zodErrors - Zod validation errors
 * @returns Formatted error message string
 */
export function formatValidationErrors(messageIndex: number, zodErrors: any[]): string {
  if (!Array.isArray(zodErrors) || zodErrors.length === 0) {
    return 'Unknown validation error'
  }

  const formatted = zodErrors
    .map((error) => {
      // Build path: ["media", "enrichment", 0, "createdAt"] -> "media.enrichment.0.createdAt"
      const path = (error.path || []).join('.')
      const pathPrefix = path ? `${path}: ` : ''
      return `${pathPrefix}${error.message}`
    })
    .join('; ')

  return formatted
}

/**
 * AC04: Detect if message has snake_case fields
 * Recursively checks for snake_case field names
 * @param obj - Object to check
 * @returns true if any snake_case fields found
 */
export function hasSnakeCaseFields(obj: any, depth = 0): boolean {
  if (depth > 10) return false // Prevent infinite recursion
  if (typeof obj !== 'object' || obj === null) return false

  for (const key of Object.keys(obj)) {
    // Check if key contains underscore (snake_case indicator)
    if (key.includes('_') && !key.startsWith('__')) {
      return true
    }

    // Recursively check nested objects
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasSnakeCaseFields(obj[key], depth + 1)) {
        return true
      }
    }
  }

  return false
}

/**
 * Get all snake_case fields in an object (for error reporting)
 * @param obj - Object to check
 * @returns Array of field names that use snake_case
 */
export function getSnakeCaseFields(obj: any, prefix = '', depth = 0): string[] {
  if (depth > 10) return [] // Prevent infinite recursion
  if (typeof obj !== 'object' || obj === null) return []

  const snakeCaseFields: string[] = []

  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key

    // Check if key contains underscore (snake_case indicator)
    if (key.includes('_') && !key.startsWith('__')) {
      snakeCaseFields.push(fullPath)
    }

    // Recursively check nested objects
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      snakeCaseFields.push(...getSnakeCaseFields(obj[key], fullPath, depth + 1))
    }
  }

  return snakeCaseFields
}

/**
 * AC03: Collect validation errors from multiple messages
 * Helper to aggregate errors with message index
 * @param errorList - List of validation errors
 * @returns Formatted error messages with indices
 */
export function collectValidationErrors(errorList: ValidationError[]): string[] {
  return errorList.map((e) => `messages.${e.index}.${e.fieldPath}: ${e.message}`)
}
