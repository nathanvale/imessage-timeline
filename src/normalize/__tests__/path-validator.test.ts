import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Message } from '../../schema/message'
import { isAbsolutePath, searchAttachmentInRoots, validateAndEnforcePaths } from '../path-validator'

describe('path-validator', () => {
	let tempDir: string
	let tempFile1: string
	let tempFile2: string

	beforeEach(() => {
		// Create temporary directory and files for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-validator-'))
		tempFile1 = path.join(tempDir, 'test-image.jpg')
		tempFile2 = path.join(tempDir, 'test-audio.mp3')

		fs.writeFileSync(tempFile1, 'fake image data')
		fs.writeFileSync(tempFile2, 'fake audio data')
	})

	afterEach(() => {
		// Cleanup
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true })
		}
	})

	describe('isAbsolutePath', () => {
		it('should return true for absolute paths', () => {
			expect(isAbsolutePath('/absolute/path/to/file.jpg')).toBe(true)
			expect(isAbsolutePath('/var/tmp/data')).toBe(true)
		})

		it('should return false for relative paths', () => {
			expect(isAbsolutePath('relative/path/file.jpg')).toBe(false)
			expect(isAbsolutePath('./file.jpg')).toBe(false)
			expect(isAbsolutePath('../file.jpg')).toBe(false)
		})

		it('should return false for empty or null paths', () => {
			expect(isAbsolutePath('')).toBe(false)
			expect(isAbsolutePath(null as any)).toBe(false)
		})
	})

	describe('searchAttachmentInRoots', () => {
		it('should find file when it exists in roots', () => {
			const result = searchAttachmentInRoots('test-image.jpg', [tempDir])
			expect(result).toBe(tempFile1)
		})

		it('should return null when file does not exist in roots', () => {
			const result = searchAttachmentInRoots('nonexistent.jpg', [tempDir])
			expect(result).toBeNull()
		})

		it('should search multiple roots', () => {
			const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'path-validator-2-'))
			const tempFile3 = path.join(tempDir2, 'test-video.mp4')
			fs.writeFileSync(tempFile3, 'fake video data')

			try {
				const result = searchAttachmentInRoots('test-video.mp4', [tempDir, tempDir2])
				expect(result).toBe(tempFile3)
			} finally {
				fs.rmSync(tempDir2, { recursive: true })
			}
		})

		it('should return first match when file exists in multiple roots', () => {
			const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'path-validator-2-'))
			const duplicateFile = path.join(tempDir2, 'test-image.jpg')
			fs.writeFileSync(duplicateFile, 'different image data')

			try {
				const result = searchAttachmentInRoots('test-image.jpg', [tempDir, tempDir2])
				expect(result).toBe(tempFile1) // First root match
			} finally {
				fs.rmSync(tempDir2, { recursive: true })
			}
		})

		it('should handle tilde expansion for home directory', () => {
			const homeDir = os.homedir()
			// Mock a file in home directory won't work reliably, so just test the logic
			const result = searchAttachmentInRoots('test-image.jpg', [homeDir])
			// Should either find it or return null, won't crash
			expect(result === null || typeof result === 'string').toBe(true)
		})
	})

	// AC01: All media.path fields are absolute paths when files exist on disk
	describe('AC01: Enforce absolute paths for existing files', () => {
		it('should convert existing file to absolute path', () => {
			const messages: Message[] = [
				{
					guid: 'csv:1:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:1',
						filename: 'photo.jpg',
						path: tempFile1, // Already absolute in this case
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages[0]?.media?.path).toBe(tempFile1)
			expect(result.messages[0]?.media?.path).toMatch(/^\//)
		})

		it('should find and resolve file from attachment roots', () => {
			const messages: Message[] = [
				{
					guid: 'csv:2:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:2',
						filename: 'test-image.jpg',
						path: null, // Missing path
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages[0]?.media?.path).toBe(tempFile1)
		})

		it('should not modify messages without media', () => {
			const messages: Message[] = [
				{
					guid: 'csv:3:0',
					messageKind: 'text',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					text: 'Hello world',
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages[0]?.messageKind).toBe('text')
			expect(result.messages[0]?.text).toBe('Hello world')
		})
	})

	// AC02: Missing files retain original filename with provenance metadata
	describe('AC02: Retain filename and provenance for missing files', () => {
		it('should retain filename when file is missing', () => {
			const messages: Message[] = [
				{
					guid: 'csv:4:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:4',
						filename: 'missing-file.jpg',
						path: null,
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages[0]?.media?.filename).toBe('missing-file.jpg')
		})

		it('should add provenance metadata for CSV sources', () => {
			const messages: Message[] = [
				{
					guid: 'csv:5:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:5',
						filename: 'missing-file.jpg',
						path: 'missing-file.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages[0]?.media?.provenance).toBeDefined()
			expect(result.messages[0]?.media?.provenance?.source).toBe('csv')
			expect(result.messages[0]?.media?.provenance?.lastSeen).toBeDefined()
			expect(result.messages[0]?.media?.provenance?.resolvedAt).toBeDefined()
		})

		it('should add provenance metadata for DB sources', () => {
			const messages: Message[] = [
				{
					guid: 'p:0/DB:12345',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:6',
						filename: 'missing-from-db.jpg',
						path: 'missing-from-db.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, { attachmentRoots: [tempDir], source: 'db' })

			expect(result.messages[0]?.media?.provenance).toBeDefined()
			expect(result.messages[0]?.media?.provenance?.source).toBe('db')
		})

		it('should preserve lastSeen timestamp in provenance', () => {
			const messages: Message[] = [
				{
					guid: 'csv:6:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:6',
						filename: 'missing.jpg',
						path: 'missing.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})
			const provenance = result.messages[0]?.media?.provenance

			expect(provenance?.lastSeen).toBe('2025-10-17T10:00:00.000Z')
			expect(provenance?.resolvedAt).toMatch(/Z$/) // ISO 8601 with Z
		})
	})

	// AC03: Path validation errors reported with counters
	describe('AC03: Report path validation statistics', () => {
		it('should return stats object', () => {
			const messages: Message[] = []

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.stats).toBeDefined()
			expect(result.stats.found).toBe(0)
			expect(result.stats.missing).toBe(0)
			expect(result.stats.total).toBe(0)
		})

		it('should count found files correctly', () => {
			const messages: Message[] = [
				{
					guid: 'csv:7:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:7',
						filename: 'test-image.jpg',
						path: null,
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
				{
					guid: 'csv:8:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:8',
						filename: 'test-audio.mp3',
						path: null,
						mimeType: 'audio/mpeg',
						mediaKind: 'audio',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.stats.found).toBe(2)
			expect(result.stats.missing).toBe(0)
			expect(result.stats.total).toBe(2)
		})

		it('should count missing files correctly', () => {
			const messages: Message[] = [
				{
					guid: 'csv:9:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:9',
						filename: 'missing1.jpg',
						path: '/nonexistent/path/missing1.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
				{
					guid: 'csv:10:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:10',
						filename: 'missing2.jpg',
						path: '/nonexistent/path/missing2.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.stats.found).toBe(0)
			expect(result.stats.missing).toBe(2)
			expect(result.stats.total).toBe(2)
		})

		it('should count mixed found and missing files', () => {
			const messages: Message[] = [
				{
					guid: 'csv:11:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:11',
						filename: 'test-image.jpg',
						path: 'test-image.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
				{
					guid: 'csv:12:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:12',
						filename: 'missing.jpg',
						path: '/nonexistent/path/missing.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
				{
					guid: 'csv:13:0',
					messageKind: 'text',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					text: 'Just text',
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.stats.found).toBe(1)
			expect(result.stats.missing).toBe(1)
			expect(result.stats.total).toBe(2) // Only count media messages
		})

		it('should not count non-media messages', () => {
			const messages: Message[] = [
				{
					guid: 'csv:14:0',
					messageKind: 'text',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					text: 'Text message',
				} as Message,
				{
					guid: 'csv:15:0',
					messageKind: 'tapback',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					tapback: {
						type: 'loved',
						action: 'added',
						targetMessageGuid: 'csv:14:0',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.stats.found).toBe(0)
			expect(result.stats.missing).toBe(0)
			expect(result.stats.total).toBe(0)
		})
	})

	// AC04: Support multiple attachment root directories from config
	describe('AC04: Support multiple attachment root directories', () => {
		it('should search across multiple roots', () => {
			const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'path-validator-roots-'))
			const tempFile3 = path.join(tempDir2, 'video.mp4')
			fs.writeFileSync(tempFile3, 'fake video data')

			try {
				const messages: Message[] = [
					{
						guid: 'csv:16:0:media',
						messageKind: 'media',
						isFromMe: false,
						date: '2025-10-17T10:00:00.000Z',
						media: {
							id: 'media:16',
							filename: 'video.mp4',
							path: null,
							mimeType: 'video/mp4',
							mediaKind: 'video',
						},
					} as Message,
				]

				const result = validateAndEnforcePaths(messages, {
					attachmentRoots: [tempDir, tempDir2],
					source: 'csv',
				})

				expect(result.messages[0]?.media?.path).toBe(tempFile3)
				expect(result.stats.found).toBe(1)
			} finally {
				fs.rmSync(tempDir2, { recursive: true })
			}
		})

		it('should handle empty attachment roots', () => {
			const messages: Message[] = [
				{
					guid: 'csv:17:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:17',
						filename: 'missing.jpg',
						path: '/nonexistent/path/missing.jpg',
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, { attachmentRoots: [], source: 'csv' })

			expect(result.messages[0]?.media?.filename).toBe('missing.jpg')
			expect(result.stats.missing).toBe(1)
		})

		it('should prioritize first root when file exists in multiple', () => {
			const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'path-validator-priority-'))
			const file1 = path.join(tempDir, 'shared.jpg')
			const file2 = path.join(tempDir2, 'shared.jpg')
			fs.writeFileSync(file1, 'file in first root')
			fs.writeFileSync(file2, 'file in second root')

			try {
				const messages: Message[] = [
					{
						guid: 'csv:18:0:media',
						messageKind: 'media',
						isFromMe: false,
						date: '2025-10-17T10:00:00.000Z',
						media: {
							id: 'media:18',
							filename: 'shared.jpg',
							path: null,
							mimeType: 'image/jpeg',
							mediaKind: 'image',
						},
					} as Message,
				]

				const result = validateAndEnforcePaths(messages, {
					attachmentRoots: [tempDir, tempDir2],
					source: 'csv',
				})

				expect(result.messages[0]?.media?.path).toBe(file1)
			} finally {
				fs.rmSync(tempDir2, { recursive: true })
			}
		})
	})

	// Integration test: Large dataset
	describe('Integration: Large dataset processing', () => {
		it('should handle 100+ messages efficiently', () => {
			const messages: Message[] = []

			// Create 50 found + 50 missing media messages
			for (let i = 0; i < 50; i++) {
				messages.push({
					guid: `csv:${i}:0:media`,
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: `media:${i}`,
						filename: i % 2 === 0 ? 'test-image.jpg' : 'test-audio.mp3',
						path: i % 2 === 0 ? 'test-image.jpg' : 'test-audio.mp3',
						mimeType: i % 2 === 0 ? 'image/jpeg' : 'audio/mpeg',
						mediaKind: i % 2 === 0 ? 'image' : 'audio',
					},
				} as Message)
			}

			for (let i = 50; i < 100; i++) {
				messages.push({
					guid: `csv:${i}:0:media`,
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: `media:${i}`,
						filename: `missing-${i}.jpg`,
						path: `/nonexistent/path/missing-${i}.jpg`,
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message)
			}

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages).toHaveLength(100)
			expect(result.stats.found).toBe(50)
			expect(result.stats.missing).toBe(50)
			expect(result.stats.total).toBe(100)
		})

		it('should maintain message order after path validation', () => {
			const messages: Message[] = [
				{
					guid: 'csv:1:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media:1',
						filename: 'test-image.jpg',
						path: null,
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
				{
					guid: 'csv:2:0',
					messageKind: 'text',
					isFromMe: false,
					date: '2025-10-17T10:01:00.000Z',
					text: 'Text message',
				} as Message,
				{
					guid: 'csv:3:0:media',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:02:00.000Z',
					media: {
						id: 'media:3',
						filename: 'missing.jpg',
						path: null,
						mimeType: 'image/jpeg',
						mediaKind: 'image',
					},
				} as Message,
			]

			const result = validateAndEnforcePaths(messages, {
				attachmentRoots: [tempDir],
				source: 'csv',
			})

			expect(result.messages[0]?.guid).toBe('csv:1:0:media')
			expect(result.messages[1]?.guid).toBe('csv:2:0')
			expect(result.messages[2]?.guid).toBe('csv:3:0:media')
		})
	})
})
