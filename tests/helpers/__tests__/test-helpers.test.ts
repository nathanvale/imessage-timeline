/**
 * Test Helper Utilities Test Suite
 *
 * Tests for CI--T04: Create test helper utilities
 * Verifies all helper functions work correctly
 */

import { describe, expect, it } from 'vitest'

import {
	createMediaMessageFixture,
	createMessageFixture,
	createMessagesFixture,
	createTapbackFixture,
	fixtureExists,
	getFixturePath,
} from '../fixture-loaders'
import {
	createMockFirecrawl,
	createMockGeminiVision,
	createMockProviderSuite,
	resetAllMocks,
	setupMockFailures,
} from '../mock-providers'
import {
	assertMediaMessage,
	assertTapbackMessage,
	assertTextMessage,
	assertValidGuid,
	assertValidISO8601,
	assertValidMessage,
	getValidationStats,
	validateMessage,
	validateMessages,
} from '../schema-assertions'
import {
	alternatingMessages,
	conversationThread,
	dailyMessagePattern,
	mediaMessages,
	messageBuilder,
	tapbackMessages,
} from '../test-data-builders'

describe('Test Helper Utilities', () => {
	// ==========================================================================
	// Mock Providers Tests (AC02)
	// ==========================================================================

	describe('Mock Providers', () => {
		it('should create mock Gemini Vision API', async () => {
			const mock = createMockGeminiVision()
			const result = await mock('/path/to/image.jpg')

			expect(result).toMatchObject({
				visionSummary: expect.stringContaining('image.jpg'),
				shortDescription: expect.stringContaining('image.jpg'),
				provider: 'gemini',
				model: 'gemini-1.5-pro',
			})
			expect(mock).toHaveBeenCalledTimes(1)
		})

		it('should create mock Firecrawl API', async () => {
			const mock = createMockFirecrawl()
			const result = await mock('https://example.com')

			expect(result).toMatchObject({
				title: expect.stringContaining('example.com'),
				summary: expect.any(String),
				provider: 'firecrawl',
			})
		})

		it('should create full provider suite', () => {
			const suite = createMockProviderSuite()

			expect(suite.geminiVision).toBeDefined()
			expect(suite.geminiAudio).toBeDefined()
			expect(suite.geminiPdf).toBeDefined()
			expect(suite.firecrawl).toBeDefined()
			expect(suite.youtube).toBeDefined()
			expect(suite.spotify).toBeDefined()
		})

		it('should reset all mocks', async () => {
			const suite = createMockProviderSuite()

			await suite.firecrawl('https://test.com')
			await suite.geminiVision('/test.jpg')

			expect(suite.firecrawl).toHaveBeenCalledTimes(1)
			expect(suite.geminiVision).toHaveBeenCalledTimes(1)

			resetAllMocks(suite)

			expect(suite.firecrawl).toHaveBeenCalledTimes(0)
			expect(suite.geminiVision).toHaveBeenCalledTimes(0)
		})

		it('should setup mock failures', async () => {
			const suite = createMockProviderSuite()
			setupMockFailures(suite, 'Rate limited')

			await expect(suite.firecrawl('https://test.com')).rejects.toThrow('Rate limited')
			await expect(suite.geminiVision('/test.jpg')).rejects.toThrow('Rate limited')
		})
	})

	// ==========================================================================
	// Fixture Loaders Tests (AC03)
	// ==========================================================================

	describe('Fixture Loaders', () => {
		it('should create message fixture', () => {
			const msg = createMessageFixture()

			expect(msg.guid).toBeDefined()
			expect(msg.messageKind).toBe('text')
			expect(msg.date).toMatch(/^\d{4}-\d{2}-\d{2}T/)
		})

		it('should create message fixture with overrides', () => {
			const msg = createMessageFixture({
				text: 'Custom text',
				isFromMe: true,
				handle: 'Alice',
			})

			expect(msg.text).toBe('Custom text')
			expect(msg.isFromMe).toBe(true)
			expect(msg.handle).toBe('Alice')
		})

		it('should create multiple messages', () => {
			const messages = createMessagesFixture(5, (i) => ({
				text: `Message ${i}`,
			}))

			expect(messages).toHaveLength(5)
			expect(messages[0].text).toBe('Message 0')
			expect(messages[4].text).toBe('Message 4')
		})

		it('should create media message fixture', () => {
			const imgMsg = createMediaMessageFixture('image')

			expect(imgMsg.messageKind).toBe('media')
			expect(imgMsg.media).toBeDefined()
			expect(imgMsg.media?.mediaKind).toBe('image')
			expect(imgMsg.media?.filename).toContain('image')
		})

		it('should create tapback fixture', () => {
			const tapback = createTapbackFixture('liked', 'parent-guid-123')

			expect(tapback.messageKind).toBe('tapback')
			expect(tapback.tapback).toBeDefined()
			expect(tapback.tapback?.tapbackKind).toBe('liked')
			expect(tapback.tapback?.targetGuid).toBe('parent-guid-123')
		})

		it('should check fixture existence', () => {
			// This will always be false in test env unless fixtures actually exist
			const exists = fixtureExists('test.json')
			expect(typeof exists).toBe('boolean')
		})

		it('should get fixture path', () => {
			const path = getFixturePath('test.json')
			expect(path).toContain('tests/fixtures/test.json')
		})
	})

	// ==========================================================================
	// Schema Assertions Tests (AC04)
	// ==========================================================================

	describe('Schema Assertions', () => {
		it('should validate valid message', () => {
			const msg = createMessageFixture()
			const result = validateMessage(msg)

			expect(result.success).toBe(true)
			expect(result.data).toBeDefined()
		})

		it('should detect invalid message', () => {
			const invalid = {
				guid: '',
				messageKind: 'invalid',
			}
			const result = validateMessage(invalid)

			expect(result.success).toBe(false)
			expect(result.errors).toBeDefined()
			expect(result.errors!.length).toBeGreaterThan(0)
		})

		it('should validate message array', () => {
			const messages = createMessagesFixture(3)
			const results = validateMessages(messages)

			expect(results).toHaveLength(3)
			expect(results.every((r) => r.success)).toBe(true)
		})

		it('should assert valid message', () => {
			const msg = createMessageFixture()
			expect(() => assertValidMessage(msg)).not.toThrow()
		})

		it('should assert text message', () => {
			const msg = createMessageFixture({ messageKind: 'text', text: 'Test' })
			expect(() => assertTextMessage(msg)).not.toThrow()
		})

		it('should assert media message', () => {
			const msg = createMediaMessageFixture('image')
			expect(() => assertMediaMessage(msg)).not.toThrow()
		})

		it('should assert tapback message', () => {
			const msg = createTapbackFixture('liked', 'parent-123')
			expect(() => assertTapbackMessage(msg)).not.toThrow()
		})

		it('should validate ISO 8601 date', () => {
			const date = new Date().toISOString()
			expect(() => assertValidISO8601(date)).not.toThrow()
		})

		it('should validate GUID', () => {
			expect(() => assertValidGuid('test-guid-123')).not.toThrow()
			expect(() => assertValidGuid('csv:1:0', 'csv:')).not.toThrow()
		})

		it('should get validation stats', () => {
			const messages = createMessagesFixture(10)
			const stats = getValidationStats(messages)

			expect(stats.totalCount).toBe(10)
			expect(stats.validCount).toBe(10)
			expect(stats.invalidCount).toBe(0)
			expect(stats.byKind.text).toBe(10)
		})
	})

	// ==========================================================================
	// Test Data Builders Tests
	// ==========================================================================

	describe('Test Data Builders', () => {
		it('should build text message with builder', () => {
			const msg = messageBuilder().text('Hello world').fromMe().read().build()

			expect(msg.text).toBe('Hello world')
			expect(msg.isFromMe).toBe(true)
			expect(msg.isRead).toBe(true)
		})

		it('should build media message with builder', () => {
			const msg = messageBuilder().image('photo.heic').build()

			expect(msg.messageKind).toBe('media')
			expect(msg.media?.filename).toBe('photo.heic')
			expect(msg.media?.mediaKind).toBe('image')
		})

		it('should build tapback with builder', () => {
			const msg = messageBuilder().tapback('loved', 'parent-guid').build()

			expect(msg.messageKind).toBe('tapback')
			expect(msg.tapback?.tapbackKind).toBe('loved')
			expect(msg.tapback?.targetGuid).toBe('parent-guid')
		})

		it('should create conversation thread', () => {
			const thread = conversationThread(5)

			expect(thread).toHaveLength(5)
			expect(thread[1].threadTargetGuid).toBe(thread[0].guid)
			expect(thread[4].threadTargetGuid).toBe(thread[3].guid)
		})

		it('should create alternating messages', () => {
			const messages = alternatingMessages(6)

			expect(messages).toHaveLength(6)
			expect(messages[0].isFromMe).toBe(false)
			expect(messages[1].isFromMe).toBe(true)
			expect(messages[2].isFromMe).toBe(false)
		})

		it('should create media messages', () => {
			const messages = mediaMessages(2)

			expect(messages.length).toBeGreaterThan(0)
			expect(messages.every((m) => m.messageKind === 'media')).toBe(true)
		})

		it('should create tapback messages', () => {
			const tapbacks = tapbackMessages('parent-123', ['liked', 'loved'])

			expect(tapbacks).toHaveLength(2)
			expect(tapbacks[0].tapback?.tapbackKind).toBe('liked')
			expect(tapbacks[1].tapback?.tapbackKind).toBe('loved')
		})

		it('should create daily message pattern', () => {
			const messages = dailyMessagePattern('2025-10-19')

			expect(messages.length).toBeGreaterThan(10)

			// Check messages span the day
			const hours = messages.map((m) => new Date(m.date).getHours())
			const minHour = Math.min(...hours)
			const maxHour = Math.max(...hours)

			expect(minHour).toBeLessThan(12) // Morning messages
			expect(maxHour).toBeGreaterThan(17) // Evening messages
		})
	})

	// ==========================================================================
	// Integration Tests
	// ==========================================================================

	describe('Integration: Helpers Working Together', () => {
		it('should use builders + assertions together', () => {
			const msg = messageBuilder()
				.text('Test message')
				.fromMe()
				.imessage()
				.read()
				.deliveredAt(new Date())
				.build()

			assertValidMessage(msg)
			assertTextMessage(msg)
			assertValidISO8601(msg.date)
			assertValidGuid(msg.guid)
		})

		it('should use fixtures + validation stats together', () => {
			const messages = createMessagesFixture(20, (i) => ({
				text: `Message ${i}`,
				isFromMe: i % 2 === 0,
			}))

			const stats = getValidationStats(messages)

			expect(stats.validCount).toBe(20)
			expect(stats.byKind.text).toBe(20)
		})

		it('should use mocks + builders for enrichment testing', async () => {
			const suite = createMockProviderSuite()
			const msg = messageBuilder().image('test.jpg', '/abs/path/test.jpg').build()

			const result = await suite.geminiVision(msg.media!.path)

			expect(result.visionSummary).toBeDefined()
			expect(result.shortDescription).toBeDefined()
		})
	})
})
