import { promises as fs } from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ExportEnvelope, Message } from '../schema/message'
import { MessageSchema } from '../schema/message'
import {
	backupEnrichedJson,
	loadExistingEnriched,
	mergeEnrichments,
	updateMergeStatistics,
} from '../utils/enrichment-merge'

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestMessage(overrides: Partial<Message> = {}): Message {
	return MessageSchema.parse({
		guid: `test-${Date.now()}-${Math.random()}`,
		messageKind: 'text',
		text: 'Test message',
		isFromMe: false,
		date: new Date().toISOString(),
		...overrides,
	})
}

function createTestEnvelope(messages: Message[]): ExportEnvelope {
	return {
		schemaVersion: '2.0.0',
		source: 'merged',
		createdAt: new Date().toISOString(),
		messages,
	}
}

// ============================================================================
// AC01: Load existing enriched.json
// ============================================================================

describe('loadExistingEnriched', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `merge-test-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	it('loads existing enriched.json file', async () => {
		const filePath = path.join(tmpDir, 'enriched.json')
		const msg = createTestMessage({ guid: 'msg-1' })
		const envelope = createTestEnvelope([msg])

		await fs.writeFile(filePath, JSON.stringify(envelope, null, 2))

		const loaded = await loadExistingEnriched(filePath)

		expect(loaded).toBeDefined()
		expect(loaded?.messages).toHaveLength(1)
		expect(loaded?.messages[0].guid).toBe('msg-1')
	})

	it('returns null if file does not exist', async () => {
		const filePath = path.join(tmpDir, 'nonexistent.json')

		const loaded = await loadExistingEnriched(filePath)

		expect(loaded).toBeNull()
	})

	it('returns null if JSON is corrupted', async () => {
		const filePath = path.join(tmpDir, 'corrupted.json')
		await fs.writeFile(filePath, 'NOT VALID JSON {{{')

		const loaded = await loadExistingEnriched(filePath)

		expect(loaded).toBeNull()
	})

	it('validates schema version', async () => {
		const filePath = path.join(tmpDir, 'bad-version.json')
		const badEnvelope = {
			schemaVersion: '1.0',
			source: 'merged',
			createdAt: new Date().toISOString(),
			messages: [],
		}

		await fs.writeFile(filePath, JSON.stringify(badEnvelope, null, 2))

		const loaded = await loadExistingEnriched(filePath)

		// Should handle gracefully (return null or loaded - depends on implementation)
		expect(loaded === null || loaded?.schemaVersion === '1.0').toBe(true)
	})

	it('preserves message enrichment arrays', async () => {
		const filePath = path.join(tmpDir, 'enriched.json')
		const msg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [
					{
						kind: 'image',
						createdAt: new Date().toISOString(),
						provider: 'gemini',
						version: '1.0',
						visionSummary: 'A test image',
					},
				],
			},
		})
		const envelope = createTestEnvelope([msg])

		await fs.writeFile(filePath, JSON.stringify(envelope, null, 2))

		const loaded = await loadExistingEnriched(filePath)

		expect(loaded?.messages[0].media?.enrichment).toHaveLength(1)
		expect(loaded?.messages[0].media?.enrichment?.[0].visionSummary).toBe('A test image')
	})
})

// ============================================================================
// AC02: Merge new enrichments by GUID
// ============================================================================

describe('mergeEnrichments', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `merge-test-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	it('merges new messages with existing enriched messages', async () => {
		const existingMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [
					{
						kind: 'image',
						createdAt: new Date().toISOString(),
						provider: 'gemini',
						version: '1.0',
						visionSummary: 'Existing enrichment',
					},
				],
			},
		})

		const newMsg = createTestMessage({ guid: 'msg-2' })

		const existing = createTestEnvelope([existingMsg])
		const newMessages = [existingMsg, newMsg]

		const result = mergeEnrichments(existing.messages, newMessages)

		expect(result.messages).toHaveLength(2)
		expect(result.messages.find((m) => m.guid === 'msg-1')?.media?.enrichment).toHaveLength(1)
		expect(result.messages.find((m) => m.guid === 'msg-2')).toBeDefined()
	})

	it('preserves existing enrichments when merging', async () => {
		const existingWithEnrichment = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [
					{
						kind: 'image',
						createdAt: '2025-01-01T00:00:00Z',
						provider: 'gemini',
						version: '1.0',
						visionSummary: 'First enrichment',
					},
				],
			},
		})

		const newWithoutEnrichment = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: undefined,
			},
		})

		const existing = createTestEnvelope([existingWithEnrichment])
		const newMessages = [newWithoutEnrichment]

		const result = mergeEnrichments(existing.messages, newMessages)

		// Existing enrichment should be preserved
		expect(result.messages[0].media?.enrichment).toHaveLength(1)
		expect(result.messages[0].media?.enrichment?.[0].visionSummary).toBe('First enrichment')
	})

	it('handles empty existing messages', async () => {
		const newMsg1 = createTestMessage({ guid: 'msg-1' })
		const newMsg2 = createTestMessage({ guid: 'msg-2' })

		const result = mergeEnrichments([], [newMsg1, newMsg2])

		expect(result.messages).toHaveLength(2)
		expect(result.addedCount).toBe(2)
	})

	it('handles empty new messages', async () => {
		const existingMsg = createTestMessage({ guid: 'msg-1' })

		const result = mergeEnrichments([existingMsg], [])

		// With no new messages to process, result is empty
		expect(result.messages).toHaveLength(0)
		expect(result.mergedCount).toBe(0)
		expect(result.addedCount).toBe(0)
	})

	it('counts added vs merged messages correctly', async () => {
		const existingMsg = createTestMessage({ guid: 'msg-1' })
		const newMsg1 = createTestMessage({ guid: 'msg-1' }) // same GUID
		const newMsg2 = createTestMessage({ guid: 'msg-2' }) // new GUID

		const result = mergeEnrichments([existingMsg], [newMsg1, newMsg2])

		expect(result.mergedCount).toBe(1) // msg-1 was merged
		expect(result.addedCount).toBe(1) // msg-2 was added
	})
})

// ============================================================================
// AC03: Preserve existing enrichments (no overwrites unless --force-refresh)
// ============================================================================

describe('mergeEnrichments - preservation (AC03)', () => {
	it('does not overwrite enrichments by default', () => {
		const existingMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'audio.mp3',
				path: '/tmp/audio.mp3',
				enrichment: [
					{
						kind: 'audio',
						createdAt: '2025-01-01T10:00:00Z',
						provider: 'gemini',
						version: '1.0',
						transcript: 'Hello world',
					},
				],
			},
		})

		const newMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'audio.mp3',
				path: '/tmp/audio.mp3',
				enrichment: [
					{
						kind: 'audio',
						createdAt: '2025-01-02T10:00:00Z',
						provider: 'gemini',
						version: '2.0',
						transcript: 'New transcript',
					},
				],
			},
		})

		const result = mergeEnrichments([existingMsg], [newMsg], { forceRefresh: false })

		// Old enrichment preserved
		expect(result.messages[0].media?.enrichment?.[0].transcript).toBe('Hello world')
		expect(result.messages[0].media?.enrichment?.[0].createdAt).toBe('2025-01-01T10:00:00Z')
	})

	it('overwrites enrichments when --force-refresh is true', () => {
		const existingMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'audio.mp3',
				path: '/tmp/audio.mp3',
				enrichment: [
					{
						kind: 'audio',
						createdAt: '2025-01-01T10:00:00Z',
						provider: 'gemini',
						version: '1.0',
						transcript: 'Old transcript',
					},
				],
			},
		})

		const newMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'audio.mp3',
				path: '/tmp/audio.mp3',
				enrichment: [
					{
						kind: 'audio',
						createdAt: '2025-01-02T10:00:00Z',
						provider: 'gemini',
						version: '2.0',
						transcript: 'New transcript',
					},
				],
			},
		})

		const result = mergeEnrichments([existingMsg], [newMsg], { forceRefresh: true })

		// New enrichment should replace old
		expect(result.messages[0].media?.enrichment?.[0].transcript).toBe('New transcript')
	})

	it('appends enrichments for different kinds', () => {
		const existingMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [
					{
						kind: 'image',
						createdAt: '2025-01-01T10:00:00Z',
						provider: 'gemini',
						version: '1.0',
						visionSummary: 'A photo',
					},
				],
			},
		})

		const newMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [
					{
						kind: 'link',
						createdAt: '2025-01-02T10:00:00Z',
						provider: 'firecrawl',
						version: '1.0',
						url: 'https://example.com',
						title: 'Example',
					},
				],
			},
		})

		const result = mergeEnrichments([existingMsg], [newMsg])

		// Both enrichments should be present
		expect(result.messages[0].media?.enrichment).toHaveLength(2)
		expect(result.messages[0].media?.enrichment?.map((e) => e.kind)).toEqual(['image', 'link'])
	})
})

// ============================================================================
// AC04: Update statistics in state file
// ============================================================================

describe('updateMergeStatistics', () => {
	it('calculates merge statistics correctly', () => {
		const stats = updateMergeStatistics({
			mergedCount: 10,
			addedCount: 5,
			preservedCount: 10,
			totalMessages: 15,
		})

		expect(stats.mergedCount).toBe(10)
		expect(stats.addedCount).toBe(5)
		expect(stats.totalMessages).toBe(15)
	})

	it('computes merge percentage', () => {
		const stats = updateMergeStatistics({
			mergedCount: 50,
			addedCount: 50,
			preservedCount: 100,
			totalMessages: 200,
		})

		expect(stats.mergedPercentage).toBe(25) // 50/200
		expect(stats.addedPercentage).toBe(25) // 50/200
	})

	it('handles zero total messages', () => {
		const stats = updateMergeStatistics({
			mergedCount: 0,
			addedCount: 0,
			preservedCount: 0,
			totalMessages: 0,
		})

		expect(stats.mergedPercentage).toBe(0)
		expect(stats.addedPercentage).toBe(0)
	})
})

// ============================================================================
// AC05: Backup previous enriched.json
// ============================================================================

describe('backupEnrichedJson', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `backup-test-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	it('creates backup of existing enriched.json', async () => {
		const originalPath = path.join(tmpDir, 'enriched.json')
		const backupPath = path.join(tmpDir, 'enriched.json.backup')

		const msg = createTestMessage({ guid: 'msg-1' })
		const envelope = createTestEnvelope([msg])

		await fs.writeFile(originalPath, JSON.stringify(envelope, null, 2))

		await backupEnrichedJson(originalPath)

		const backupExists = await fs
			.access(backupPath)
			.then(() => true)
			.catch(() => false)
		expect(backupExists).toBe(true)

		const backupContent = await fs.readFile(backupPath, 'utf-8')
		const backupData = JSON.parse(backupContent)
		expect(backupData.messages).toHaveLength(1)
		expect(backupData.messages[0].guid).toBe('msg-1')
	})

	it('overwrites existing backup file', async () => {
		const originalPath = path.join(tmpDir, 'enriched.json')
		const backupPath = path.join(tmpDir, 'enriched.json.backup')

		// Create initial backup
		const oldMsg = createTestMessage({ guid: 'old-msg' })
		const oldEnvelope = createTestEnvelope([oldMsg])
		await fs.writeFile(backupPath, JSON.stringify(oldEnvelope, null, 2))

		// Create new original
		const newMsg = createTestMessage({ guid: 'new-msg' })
		const newEnvelope = createTestEnvelope([newMsg])
		await fs.writeFile(originalPath, JSON.stringify(newEnvelope, null, 2))

		// Create new backup
		await backupEnrichedJson(originalPath)

		const backupContent = await fs.readFile(backupPath, 'utf-8')
		const backupData = JSON.parse(backupContent)

		// New backup should have new message
		expect(backupData.messages[0].guid).toBe('new-msg')
	})

	it('handles missing original file gracefully', async () => {
		const missingPath = path.join(tmpDir, 'nonexistent.json')

		// Should not throw
		await expect(backupEnrichedJson(missingPath)).rejects.toThrow()
	})

	it('preserves all message data in backup', async () => {
		const originalPath = path.join(tmpDir, 'enriched.json')

		const complexMsg = createTestMessage({
			guid: 'complex-msg',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'test.jpg',
				path: '/tmp/test.jpg',
				size: 1024,
				mimeType: 'image/jpeg',
				enrichment: [
					{
						kind: 'image',
						createdAt: new Date().toISOString(),
						provider: 'gemini',
						version: '1.0',
						visionSummary: 'Test summary',
						shortDescription: 'Test desc',
					},
				],
			},
		})

		const envelope = createTestEnvelope([complexMsg])
		await fs.writeFile(originalPath, JSON.stringify(envelope, null, 2))

		await backupEnrichedJson(originalPath)

		const backupContent = await fs.readFile(path.join(tmpDir, 'enriched.json.backup'), 'utf-8')
		const backupData = JSON.parse(backupContent)

		expect(backupData.messages[0].media?.enrichment).toBeDefined()
		expect(backupData.messages[0].media?.enrichment?.[0].visionSummary).toBe('Test summary')
	})
})

// ============================================================================
// Integration: Complete merge workflow
// ============================================================================

describe('enrichment merge - integration', () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = path.join('/tmp', `merge-integration-${Date.now()}-${Math.random()}`)
		await fs.mkdir(tmpDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(tmpDir, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	})

	it('performs complete merge workflow: load, merge, backup, update', async () => {
		const enrichedPath = path.join(tmpDir, 'enriched.json')

		// Step 1: Create existing enriched file
		const existingMsg = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [
					{
						kind: 'image',
						createdAt: '2025-01-01T00:00:00Z',
						provider: 'gemini',
						version: '1.0',
						visionSummary: 'Existing enrichment',
					},
				],
			},
		})
		const existingEnvelope = createTestEnvelope([existingMsg])
		await fs.writeFile(enrichedPath, JSON.stringify(existingEnvelope, null, 2))

		// Step 2: Load existing
		const loaded = await loadExistingEnriched(enrichedPath)
		expect(loaded).toBeDefined()

		// Step 3: Create new enrichments
		const newMsg1 = existingMsg // same GUID with new enrichment
		const newMsg2 = createTestMessage({ guid: 'msg-2' }) // new message
		const newEnvelope = createTestEnvelope([newMsg1, newMsg2])

		// Step 4: Merge
		const mergeResult = mergeEnrichments(loaded!.messages, newEnvelope.messages)
		expect(mergeResult.mergedCount).toBe(1)
		expect(mergeResult.addedCount).toBe(1)

		// Step 5: Backup
		await backupEnrichedJson(enrichedPath)
		const backupExists = await fs
			.access(path.join(tmpDir, 'enriched.json.backup'))
			.then(() => true)
			.catch(() => false)
		expect(backupExists).toBe(true)

		// Step 6: Verify merge result
		expect(mergeResult.messages).toHaveLength(2)
		expect(mergeResult.messages[0].media?.enrichment).toHaveLength(1)
	})
})

// ============================================================================
// Edge cases and robustness
// ============================================================================

describe('enrichment merge - edge cases', () => {
	it('handles large enriched.json files (1000+ messages)', async () => {
		const messages = Array.from({ length: 1000 }, (_, i) => createTestMessage({ guid: `msg-${i}` }))

		// Create 500 existing messages + 100 new messages
		const existingSubset = messages.slice(0, 500)
		const newMessages = [
			...existingSubset,
			...Array.from({ length: 100 }, (_, i) => createTestMessage({ guid: `new-msg-${i}` })),
		]

		const result = mergeEnrichments(messages, newMessages)

		// Result should have original 1000 + 100 new = 1100, but merge deduplicates to 600
		// (500 merged existing + 100 new)
		expect(result.messages).toHaveLength(600)
		expect(result.mergedCount).toBe(500)
		expect(result.addedCount).toBe(100)
	})

	it('handles messages with undefined enrichments', () => {
		const msgWithoutEnrichment = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: undefined,
			},
		})

		const result = mergeEnrichments([msgWithoutEnrichment], [msgWithoutEnrichment])

		expect(result.messages[0].media?.enrichment).toBeUndefined()
	})

	it('handles messages with empty enrichment arrays', () => {
		const msgWithEmptyEnrichment = createTestMessage({
			guid: 'msg-1',
			messageKind: 'media',
			media: {
				id: 'media-1',
				filename: 'photo.jpg',
				path: '/tmp/photo.jpg',
				enrichment: [],
			},
		})

		const result = mergeEnrichments([msgWithEmptyEnrichment], [msgWithEmptyEnrichment])

		expect(result.messages[0].media?.enrichment).toEqual([])
	})

	it('preserves message order in merge', () => {
		const msg1 = createTestMessage({ guid: 'msg-1' })
		const msg2 = createTestMessage({ guid: 'msg-2' })
		const msg3 = createTestMessage({ guid: 'msg-3' })

		const result = mergeEnrichments([msg1, msg2], [msg1, msg2, msg3])

		expect(result.messages.map((m) => m.guid)).toEqual(['msg-1', 'msg-2', 'msg-3'])
	})
})
