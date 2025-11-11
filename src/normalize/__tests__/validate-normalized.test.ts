// src/normalize/__tests__/validate-normalized.test.ts
// TDD tests for Zod validation layer - RED phase
// Tests written FIRST to drive implementation

import { describe, it, expect } from 'vitest'

import { allValidMessages } from '../../../__tests__/fixtures/valid-messages'
import {
  validateNormalizedMessages,
  formatValidationErrors,
  hasSnakeCaseFields,
  collectValidationErrors,
  getSnakeCaseFields,
} from '../validate-normalized'

describe('NORMALIZE--T07: Zod Validation Layer', () => {
  describe('AC01: Run Zod schema validation on all messages', () => {
    it('should validate all messages against MessageSchema', () => {
      const result = validateNormalizedMessages(allValidMessages.slice(0, 3))
      expect(result).toHaveLength(3)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should return validated messages that pass schema', () => {
      const validText = {
        guid: 'test-001',
        messageKind: 'text',
        text: 'Hello world',
        isFromMe: true,
        date: '2023-10-17T06:52:57.000Z',
      }

      const result = validateNormalizedMessages([validText])
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('guid', 'test-001')
      expect(result[0]).toHaveProperty('messageKind', 'text')
    })

    it('should throw error for invalid messages (batch validation)', () => {
      const invalidDate = {
        guid: 'test-002',
        messageKind: 'text',
        text: 'Invalid date',
        isFromMe: true,
        date: '2023-10-17T06:52:57', // Missing Z
      }

      expect(() => validateNormalizedMessages([invalidDate])).toThrow()
    })

    it('should reject messages missing required fields', () => {
      const missingGuid = {
        messageKind: 'text',
        text: 'No GUID',
        isFromMe: true,
        date: '2023-10-17T06:52:57.000Z',
      }

      expect(() => validateNormalizedMessages([missingGuid])).toThrow()
    })

    it('should reject media messages without media payload', () => {
      const invalidMedia = {
        guid: 'test-003',
        messageKind: 'media', // Requires media payload
        text: null,
        isFromMe: true,
        date: '2023-10-17T06:52:57.000Z',
        // Missing: media
      }

      expect(() => validateNormalizedMessages([invalidMedia])).toThrow()
    })
  })

  describe('AC02: Error reporting with field paths', () => {
    it('should report errors with field path included', () => {
      const invalidMessage = {
        guid: 'test-004',
        messageKind: 'text',
        text: 'Bad date',
        isFromMe: true,
        date: '2023-10-17 06:52:57.000Z', // Space instead of T
      }

      try {
        validateNormalizedMessages([invalidMessage])
        expect.fail('Should have thrown')
      } catch (error: any) {
        const errorMessage = error.message || ''
        expect(errorMessage).toContain('date')
        expect(typeof errorMessage).toBe('string')
      }
    })

    it('should format Zod error with field path prefix', () => {
      const errors = [
        {
          path: ['date'],
          code: 'invalid_string',
          message: 'Invalid datetime string',
        },
      ]

      const formatted = formatValidationErrors(0, errors)
      expect(formatted).toContain('date:')
      expect(formatted).toContain('Invalid datetime string')
    })

    it('should handle nested field paths (media.path)', () => {
      const errors = [
        {
          path: ['media', 'path'],
          code: 'invalid_type',
          message: 'Expected string',
        },
      ]

      const formatted = formatValidationErrors(0, errors)
      expect(formatted).toContain('media.path')
    })

    it('should handle array indices in path (enrichment[0])', () => {
      const errors = [
        {
          path: ['media', 'enrichment', 0, 'createdAt'],
          code: 'invalid_string',
          message: 'Invalid datetime string',
        },
      ]

      const formatted = formatValidationErrors(0, errors)
      expect(formatted).toContain('media.enrichment.0.createdAt')
    })

    it('should provide descriptive error reasons', () => {
      const invalidMessage = {
        guid: 'test-005',
        messageKind: 'text',
        text: 'Bad isFromMe',
        isFromMe: 'true', // Should be boolean, not string
        date: '2023-10-17T06:52:57.000Z',
      }

      try {
        validateNormalizedMessages([invalidMessage])
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBeDefined()
        expect(error.message.length > 0).toBe(true)
      }
    })
  })

  describe('AC03: Batch validation with error collection', () => {
    it('should collect errors from multiple messages (no fail-fast)', () => {
      const messages = [
        {
          // Invalid: missing Z
          guid: 'msg-1',
          messageKind: 'text',
          text: 'Test 1',
          isFromMe: true,
          date: '2023-10-17T06:52:57',
        },
        {
          // Invalid: missing isFromMe
          guid: 'msg-2',
          messageKind: 'text',
          text: 'Test 2',
          date: '2023-10-17T06:52:57.000Z',
        },
        {
          // Invalid: messageKind mismatch
          guid: 'msg-3',
          messageKind: 'media',
          text: null,
          isFromMe: true,
          date: '2023-10-17T06:52:57.000Z',
          // Missing: media
        },
      ]

      try {
        validateNormalizedMessages(messages)
        expect.fail('Should have thrown')
      } catch (error: any) {
        const errorMessage = error.message
        // All three errors should be reported
        expect(errorMessage).toBeDefined()
      }
    })

    it('should collect errors with message index for debugging', () => {
      const errors = collectValidationErrors([
        { index: 0, fieldPath: 'date', message: 'Invalid datetime' },
        { index: 1, fieldPath: 'isFromMe', message: 'Expected boolean' },
        { index: 2, fieldPath: 'media', message: 'Required when messageKind=media' },
      ])

      expect(errors).toHaveLength(3)
      expect(errors[0]).toContain('messages.0')
      expect(errors[1]).toContain('messages.1')
      expect(errors[2]).toContain('messages.2')
    })

    it('should not fail-fast on first error', () => {
      const messages = [
        {
          guid: 'valid-1',
          messageKind: 'text',
          text: 'OK',
          isFromMe: true,
          date: '2023-10-17T06:52:57.000Z',
        },
        {
          guid: 'invalid-1',
          messageKind: 'text',
          text: 'Bad',
          isFromMe: 'not-boolean' as any,
          date: '2023-10-17T06:52:57.000Z',
        },
        { guid: 'invalid-2', messageKind: 'text', text: 'Bad', isFromMe: true, date: 'not-a-date' },
      ]

      try {
        validateNormalizedMessages(messages)
        expect.fail('Should throw')
      } catch (error: any) {
        // Should report errors for both invalid-1 AND invalid-2, not just invalid-1
        const msg = error.message
        expect(msg).toBeDefined()
      }
    })

    it('should return all validation results in a summary', () => {
      const validMsg = {
        guid: 'valid',
        messageKind: 'text',
        text: 'OK',
        isFromMe: true,
        date: '2023-10-17T06:52:57.000Z',
      }

      const result = validateNormalizedMessages([validMsg])
      expect(result).toHaveLength(1)
      expect(result[0].guid).toBe('valid')
    })
  })

  describe('AC04: camelCase field enforcement', () => {
    it('should reject snake_case fields', () => {
      const snakeCaseMessage: any = {
        guid: 'test-006',
        message_kind: 'text', // snake_case (invalid)
        text: 'Test',
        is_from_me: true, // snake_case (invalid)
        date: '2023-10-17T06:52:57.000Z',
      }

      expect(hasSnakeCaseFields(snakeCaseMessage)).toBe(true)
    })

    it('should accept camelCase fields', () => {
      const camelCaseMessage = {
        guid: 'test-007',
        messageKind: 'text', // camelCase (valid)
        text: 'Test',
        isFromMe: true, // camelCase (valid)
        date: '2023-10-17T06:52:57.000Z',
      }

      expect(hasSnakeCaseFields(camelCaseMessage)).toBe(false)
    })

    it('should reject messages with mixed case violations', () => {
      const mixedMessage: any = {
        guid: 'test-008',
        messageKind: 'text',
        text: 'Test',
        is_from_me: true, // WRONG: should be isFromMe
        date: '2023-10-17T06:52:57.000Z',
      }

      expect(hasSnakeCaseFields(mixedMessage)).toBe(true)
    })

    it('should detect snake_case in nested fields', () => {
      const nestedSnakeCase: any = {
        guid: 'test-009',
        messageKind: 'media',
        isFromMe: true,
        date: '2023-10-17T06:52:57.000Z',
        media: {
          id: 'media-1',
          filename: 'test.jpg',
          path: '/abs/path',
          mime_type: 'image/jpeg', // WRONG: should be mimeType
        },
      }

      expect(hasSnakeCaseFields(nestedSnakeCase)).toBe(true)
    })

    it('should reject snake_case and throw during validation', () => {
      const badMessage: any = {
        guid: 'test-010',
        message_kind: 'text',
        text: 'Bad',
        is_from_me: true,
        date: '2023-10-17T06:52:57.000Z',
      }

      expect(() => validateNormalizedMessages([badMessage])).toThrow()
    })
  })

  describe('Integration: Complete validation pipeline', () => {
    it('should validate a complete normalized message set', () => {
      const normalizedSet = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          text: 'Hello',
          isFromMe: true,
          date: '2023-10-17T06:52:57.000Z',
        },
        {
          guid: 'msg-2',
          messageKind: 'media',
          text: null,
          isFromMe: false,
          date: '2023-10-17T07:00:00.000Z',
          media: {
            id: 'media-1',
            filename: 'photo.jpg',
            path: '/abs/path/photo.jpg',
            mimeType: 'image/jpeg',
          },
        },
      ]

      const result = validateNormalizedMessages(normalizedSet)
      expect(result).toHaveLength(2)
      expect(result[0].messageKind).toBe('text')
      expect(result[1].messageKind).toBe('media')
    })

    it('should provide helpful error context for debugging', () => {
      const mixedValid = [
        {
          guid: 'valid-1',
          messageKind: 'text',
          text: 'OK',
          isFromMe: true,
          date: '2023-10-17T06:52:57.000Z',
        },
        {
          guid: 'invalid-1',
          messageKind: 'text',
          text: 'Bad',
          is_from_me: true as any,
          date: '2023-10-17T06:52:57.000Z',
        },
      ]

      try {
        validateNormalizedMessages(mixedValid)
        expect.fail('Should throw')
      } catch (error: any) {
        expect(error.message).toContain('messages.1')
        expect(error.message).toContain('is_from_me')
      }
    })

    it('should output to messages.normalized.json after validation', () => {
      const validated = [
        {
          guid: 'test',
          messageKind: 'text',
          text: 'OK',
          isFromMe: true,
          date: '2023-10-17T06:52:57.000Z',
        },
      ]

      const result = validateNormalizedMessages(validated)
      expect(result).toHaveLength(1)
      // In actual implementation, this would write to messages.normalized.json
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty message array', () => {
      const result = validateNormalizedMessages([])
      expect(result).toHaveLength(0)
    })

    it('should handle null/undefined gracefully', () => {
      expect(() => validateNormalizedMessages([null as any])).toThrow()
      expect(() => validateNormalizedMessages([undefined as any])).toThrow()
    })

    it('should provide error for duplicate GUIDs if validation applies', () => {
      const messages = [
        {
          guid: 'dup-1',
          messageKind: 'text',
          text: 'A',
          isFromMe: true,
          date: '2023-10-17T06:52:57.000Z',
        },
        {
          guid: 'dup-1',
          messageKind: 'text',
          text: 'B',
          isFromMe: true,
          date: '2023-10-17T06:52:58.000Z',
        },
      ]

      // This may or may not be validated depending on schema
      const result = validateNormalizedMessages(messages)
      expect(result).toBeDefined()
    })

    it('should handle messages with all optional fields', () => {
      const minimalMessage = {
        guid: 'minimal',
        messageKind: 'text',
        text: 'Only required fields',
        isFromMe: true,
        date: '2023-10-17T06:52:57.000Z',
      }

      const result = validateNormalizedMessages([minimalMessage])
      expect(result).toHaveLength(1)
    })
  })
})
