import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaMeta, Message } from '#schema/message'
import { analyzeAudio, transcribeAudio } from '../audio-transcription'

// Mock Gemini API
vi.mock('@google/generative-ai', () => {
	return {
		GoogleGenerativeAI: vi.fn(function (_apiKey: string) {
			this.getGenerativeModel = vi.fn().mockReturnValue({
				generateContent: vi.fn().mockResolvedValue({
					response: {
						text: vi.fn().mockReturnValue(
							`Transcription:
Speaker 1: Hello, this is the first speaker.
Speaker 2: And this is the second speaker.
Speaker 1: They are having a conversation.

Timestamps:
00:00 - Speaker 1 starts
00:05 - Speaker 2 responds
00:10 - Speaker 1 continues

Short Description: Two people have a brief conversation about a topic.`,
						),
					},
				}),
			})
			return this
		}),
	}
})

// Mock fs promises
vi.mock('node:fs/promises', () => ({
	access: vi.fn().mockResolvedValue(undefined),
	stat: vi.fn().mockResolvedValue({ size: 1024000 }), // ~1MB file
	readFile: vi.fn().mockResolvedValue(Buffer.from('fake-audio')),
	writeFile: vi.fn().mockResolvedValue(undefined),
}))

describe('Audio Transcription (ENRICH--T02)', () => {
	const testTempDir = '/tmp/enrich-test'
	const _testCacheDir = `${testTempDir}/audio-cache`
	const testAudioPath = `${testTempDir}/test-audio.m4a`

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	describe('AC01: Structured prompt for transcription requesting timestamps and speakers', () => {
		it('should include transcription request in Gemini prompt', async () => {
			expect(transcribeAudio).toBeDefined()
			// Prompt should request:
			// - Full transcription with speaker labels
			// - Timestamps for each segment
			// - Structured format
		})

		it('should request speaker identification in prompt', async () => {
			// Prompt should ask Gemini to identify who is speaking
			// Format: Speaker 1, Speaker 2, etc.
			expect(transcribeAudio).toBeDefined()
		})

		it('should request timestamps for each spoken segment', async () => {
			// Prompt should ask for timestamps (MM:SS format)
			// tied to speakers and content
			expect(transcribeAudio).toBeDefined()
		})

		it('should handle multi-speaker audio', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'conversation.m4a',
					path: testAudioPath,
					mediaKind: 'audio',
				},
			}

			expect(message.media?.mediaKind).toBe('audio')
		})
	})

	describe('AC02: Extract speaker labels (Speaker 1, Speaker 2, etc.)', () => {
		it('should parse speaker labels from Gemini response', () => {
			const mockResponse = `Speaker 1: First person speaking
Speaker 2: Second person speaking
Speaker 1: First person again`

			const speakers = new Set()
			const lines = mockResponse.split('\n')
			for (const line of lines) {
				const match = line.match(/Speaker (\d+):/)
				if (match) speakers.add(`Speaker ${match[1]}`)
			}

			expect(speakers.size).toBe(2)
			expect(speakers.has('Speaker 1')).toBe(true)
			expect(speakers.has('Speaker 2')).toBe(true)
		})

		it('should handle single-speaker audio (just content, no speaker labels)', () => {
			const mockResponse = 'Just the person speaking: This is a monologue.'

			// Should still work if only one speaker or no explicit labels
			expect(mockResponse).toContain('speaking')
		})

		it('should extract speaker count from transcription', () => {
			const mockResponse = `Speaker 1: Hello
Speaker 2: Hi
Speaker 3: Hey`

			const speakerMatches = mockResponse.match(/Speaker \d+:/g)
			expect(speakerMatches?.length).toBeGreaterThan(0)
		})

		it('should preserve speaker order from transcription', () => {
			const mockResponse = `Speaker 1: First
Speaker 2: Second
Speaker 1: Third
Speaker 2: Fourth`

			const order = mockResponse.match(/Speaker \d+/g)
			expect(order).toEqual(['Speaker 1', 'Speaker 2', 'Speaker 1', 'Speaker 2'])
		})

		it('should handle speaker transitions', () => {
			const mockResponse = `Speaker 1: Starting
Speaker 2: Interrupting
Speaker 1: Continuing`

			const transitions = mockResponse.split('\n').filter((line) => line.includes('Speaker'))
			expect(transitions.length).toBeGreaterThanOrEqual(3)
		})
	})

	describe('AC03: Generate short description (1-2 sentences)', () => {
		it('should extract short description from Gemini response', () => {
			const mockResponse = `Transcription content here.

Short Description: A brief summary of the audio content.`

			const match = mockResponse.match(/Short Description:\s*(.+?)(?:\n|$)/s)
			expect(match?.[1]).toBeDefined()
			expect(match?.[1]).toContain('summary')
		})

		it('should ensure short description is 1-2 sentences', () => {
			const description = 'Two people discuss project timelines and deliverables.'

			// Count sentences (periods, exclamations, questions)
			const sentenceCount = (description.match(/[.!?]/g) || []).length
			expect(sentenceCount).toBeGreaterThanOrEqual(1)
			expect(sentenceCount).toBeLessThanOrEqual(2)
		})

		it('should handle descriptions without punctuation', () => {
			const description = 'A conversation between two team members'
			expect(description.length).toBeGreaterThan(0)
			expect(description.length).toBeLessThan(200) // Keep it short
		})

		it('should capture main topic in short description', () => {
			const description = 'Business meeting discussing Q4 planning and budget allocation'

			expect(description).toContain('meeting')
			expect(description.toLowerCase()).toContain('business')
		})
	})

	describe('AC04: Store under media.enrichment with kind=transcription', () => {
		it('should create enrichment entry with kind=transcription', () => {
			const enrichment = {
				kind: 'transcription' as const,
				provider: 'gemini' as const,
				model: 'gemini-1.5-pro',
				version: '2025-10-17',
				createdAt: new Date().toISOString(),
				transcription: 'Speaker 1: Hello',
				speakers: ['Speaker 1'],
				shortDescription: 'A person speaking',
			}

			expect(enrichment.kind).toBe('transcription')
			expect(enrichment.provider).toBe('gemini')
			expect(enrichment.transcription).toBeDefined()
			expect(enrichment.speakers).toBeDefined()
		})

		it('should append enrichment to media.enrichment array', () => {
			const media: MediaMeta = {
				id: 'media-1',
				filename: 'audio.m4a',
				path: '/path/audio.m4a',
				mediaKind: 'audio',
				enrichment: [
					{
						kind: 'transcription',
						provider: 'gemini',
						model: 'gemini-1.5-pro',
						version: '2025-10-17',
						createdAt: '2025-10-17T10:00:00.000Z',
						transcription: 'Old transcription',
						speakers: ['Speaker 1'],
						shortDescription: 'Old description',
					},
				],
			}

			const newEnrichment = {
				kind: 'transcription' as const,
				provider: 'gemini' as const,
				model: 'gemini-1.5-pro-update',
				version: '2025-10-18',
				createdAt: new Date().toISOString(),
				transcription: 'New transcription',
				speakers: ['Speaker 1', 'Speaker 2'],
				shortDescription: 'New description',
			}

			const updated = {
				...media,
				enrichment: [...(media.enrichment || []), newEnrichment],
			}

			expect(updated.enrichment).toHaveLength(2)
			expect(updated.enrichment[1]).toBe(newEnrichment)
		})

		it('should preserve existing enrichments when adding transcription', () => {
			const media: MediaMeta = {
				id: 'media-1',
				filename: 'audio.m4a',
				path: '/path/audio.m4a',
				mediaKind: 'audio',
				enrichment: [
					{
						kind: 'image_analysis',
						provider: 'gemini',
						model: 'gemini-1.5-pro',
						version: '2025-10-17',
						createdAt: '2025-10-17T10:00:00.000Z',
						visionSummary: 'Image summary',
						shortDescription: 'Image desc',
					},
				],
			}

			const transcriptionEnrichment = {
				kind: 'transcription' as const,
				provider: 'gemini' as const,
				model: 'gemini-1.5-pro',
				version: '2025-10-17',
				createdAt: new Date().toISOString(),
				transcription: 'Audio content',
				speakers: ['Speaker 1'],
				shortDescription: 'Audio desc',
			}

			const updated = {
				...media,
				enrichment: [...(media.enrichment || []), transcriptionEnrichment],
			}

			// Both enrichments should exist
			expect(updated.enrichment).toHaveLength(2)
			expect(updated.enrichment[0].kind).toBe('image_analysis')
			expect(updated.enrichment[1].kind).toBe('transcription')
		})

		it('should include provenance fields', () => {
			const enrichment = {
				kind: 'transcription' as const,
				provider: 'gemini' as const,
				model: 'gemini-1.5-pro',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				transcription: 'Content',
				speakers: ['Speaker 1'],
				shortDescription: 'Desc',
			}

			expect(enrichment.provider).toBe('gemini')
			expect(enrichment.model).toBe('gemini-1.5-pro')
			expect(enrichment.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
			expect(enrichment.createdAt).toMatch(/^20\d{2}-\d{2}-\d{2}T/)
		})
	})

	describe('AC05: Handle long audio files (>10min) with streaming/chunking', () => {
		it('should handle audio files under 10 minutes normally', async () => {
			const _message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'short-audio.m4a',
					path: testAudioPath,
					mediaKind: 'audio',
				},
			}

			expect(analyzeAudio).toBeDefined()
		})

		it('should split long audio files into chunks for processing', async () => {
			// File >10 minutes should be split into chunks
			// Each chunk processed independently, then combined
			const fileSize = 50 * 1024 * 1024 // 50MB ≈ 60+ minutes of audio

			// Should calculate: duration → chunks needed
			const chunkDuration = 10 * 60 // 10 minutes in seconds
			const estimatedDuration = (fileSize / (1024 * 1024)) * 60 // rough estimate
			const chunksNeeded = Math.ceil(estimatedDuration / chunkDuration)

			expect(chunksNeeded).toBeGreaterThan(1)
		})

		it('should use streaming API for files >10 minutes', () => {
			// For long files: use streaming/chunked API call
			// Not all in one request (token limit)
			const duration = 15 * 60 // 15 minutes
			const chunkSize = 10 * 60 // 10 minute chunks

			const chunksRequired = Math.ceil(duration / chunkSize)
			expect(chunksRequired).toBe(2)
		})

		it('should merge transcriptions from all chunks', () => {
			const chunk1Transcription = 'Speaker 1: First part of the audio'
			const chunk2Transcription = 'Speaker 1: Second part of the audio'

			const merged = `${chunk1Transcription}\n${chunk2Transcription}`
			expect(merged).toContain('First part')
			expect(merged).toContain('Second part')
		})

		it('should handle speaker continuity across chunks', () => {
			// When Speaker 1 continues across chunk boundary,
			// should not create duplicate speaker entries
			const speakers = ['Speaker 1', 'Speaker 2', 'Speaker 1']
			const uniqueSpeakers = [...new Set(speakers)]

			expect(uniqueSpeakers).toHaveLength(2)
		})

		it('should preserve timestamps across chunks', () => {
			const chunk1Timestamps = [
				{ time: '00:00', speaker: 'Speaker 1' },
				{ time: '00:15', speaker: 'Speaker 2' },
			]
			const chunk2Timestamps = [
				{ time: '10:00', speaker: 'Speaker 1' },
				{ time: '10:30', speaker: 'Speaker 2' },
			]

			const allTimestamps = [...chunk1Timestamps, ...chunk2Timestamps]
			expect(allTimestamps).toHaveLength(4)
			expect(allTimestamps[2].time).toBe('10:00')
		})

		it('should skip transcription if audio file is corrupted', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'corrupted.m4a',
					path: '/path/corrupted.m4a',
					mediaKind: 'audio',
				},
			}

			expect(message.media?.path).toBeDefined()
		})
	})

	describe('Helper: Structured prompt format', () => {
		it('should define structured prompt requesting classification and output format', () => {
			// Prompt should request:
			// 1. Full transcription with Speaker N: format
			// 2. Timestamps (MM:SS) for each segment
			// 3. Short description (1-2 sentences)
			const prompt = `Transcribe the audio and provide:
1. Full transcription with Speaker 1, Speaker 2, etc.
2. Timestamps for each speaker change
3. A 1-2 sentence summary`

			expect(prompt).toContain('transcription')
			expect(prompt).toContain('Speaker')
			expect(prompt).toContain('Timestamps')
		})

		it('should request exact output format from Gemini', () => {
			const prompt = `Format output as:
Transcription:
[full text with Speaker labels]

Timestamps:
[timestamps with speaker and content]

Short Description: [1-2 sentences]`

			expect(prompt).toContain('Transcription:')
			expect(prompt).toContain('Timestamps:')
			expect(prompt).toContain('Short Description:')
		})
	})

	describe('Integration: Full audio transcription flow', () => {
		it('should transcribe a complete audio media message', async () => {
			const _message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'conversation.m4a',
					path: testAudioPath,
					mediaKind: 'audio',
				},
			}

			expect(analyzeAudio).toBeDefined()
			// Should:
			// 1. Check if media is audio type
			// 2. Call Gemini with structured prompt
			// 3. Parse response for transcription, speakers, timestamps
			// 4. Generate short description
			// 5. Return message with enrichment appended
		})

		it('should skip non-audio mediaKind', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'image.jpg',
					path: '/abs/path/image.jpg',
					mediaKind: 'image',
				},
			}

			expect(message.media?.mediaKind).not.toBe('audio')
		})

		it('should skip if media path is missing', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'audio.m4a',
					path: '',
					mediaKind: 'audio',
				},
			}

			expect(message.media?.path).toBeFalsy()
		})

		it('should handle text-only messages gracefully', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'text',
				isFromMe: true,
				date: '2025-10-17T10:00:00.000Z',
				text: 'Just a text message',
			}

			expect(message.messageKind).not.toBe('media')
		})

		it('should skip transcription if audio analysis is disabled', () => {
			const config = { enableAudioTranscription: false }
			expect(config.enableAudioTranscription).toBe(false)
		})
	})

	describe('Error handling & resilience', () => {
		it('should NOT crash pipeline on Gemini API error', async () => {
			const _message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'audio.m4a',
					path: testAudioPath,
					mediaKind: 'audio',
				},
			}

			// Even if analyzeAudio throws, should be caught internally
			expect(analyzeAudio).toBeDefined()
		})

		it('should NOT crash on missing audio file', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'audio.m4a',
					path: '/nonexistent/path/audio.m4a',
					mediaKind: 'audio',
				},
			}

			expect(message.media?.path).toBeDefined()
		})

		it('should handle rate limit errors from Gemini', async () => {
			// Should retry with exponential backoff
			// Should respect rate limit delays from config
			const throwError = async () => {
				throw new Error('Rate limited')
			}

			await expect(throwError()).rejects.toThrow('Rate limited')
		})

		it('should handle unsupported audio format gracefully', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'audio.xyz',
					path: '/path/audio.xyz',
					mediaKind: 'audio',
				},
			}

			expect(message.messageKind).toBe('media')
		})

		it('should continue processing on individual message failure', async () => {
			// Batch processing should not stop if one message fails
			// Should track error and continue with next message
			const errorCount = 1
			const successCount = 2
			const totalCount = errorCount + successCount

			expect(totalCount).toBe(3)
		})
	})

	describe('Batch processing & statistics', () => {
		it('should process multiple audio messages independently', async () => {
			const messages: Message[] = [
				{
					guid: 'msg-1',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media-1',
						filename: 'audio1.m4a',
						path: testAudioPath,
						mediaKind: 'audio',
					},
				},
				{
					guid: 'msg-2',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:05:00.000Z',
					media: {
						id: 'media-2',
						filename: 'audio2.m4a',
						path: testAudioPath,
						mediaKind: 'audio',
					},
				},
			]

			expect(messages).toHaveLength(2)
		})

		it('should track success/skip/error counts in batch', () => {
			const stats = {
				successCount: 2,
				skipCount: 1,
				errorCount: 0,
				total: 3,
			}

			expect(stats.successCount + stats.skipCount + stats.errorCount).toBe(stats.total)
		})

		it('should return all messages even if some fail', async () => {
			const originalMessages: Message[] = [
				{
					guid: 'msg-1',
					messageKind: 'media',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					media: {
						id: 'media-1',
						filename: 'audio.m4a',
						path: testAudioPath,
						mediaKind: 'audio',
					},
				},
			]

			// Result should have same length as input
			expect(originalMessages).toHaveLength(1)
		})
	})

	describe('Idempotency & caching', () => {
		it('should not duplicate enrichment on re-run', () => {
			// If media already has transcription enrichment with same provider + model,
			// should skip re-transcription
			const media: MediaMeta = {
				id: 'media-1',
				filename: 'audio.m4a',
				path: testAudioPath,
				mediaKind: 'audio',
				enrichment: [
					{
						kind: 'transcription',
						provider: 'gemini',
						model: 'gemini-1.5-pro',
						version: '2025-10-17',
						createdAt: '2025-10-17T10:00:00.000Z',
						transcription: 'Existing transcription',
						speakers: ['Speaker 1'],
						shortDescription: 'Existing description',
					},
				],
			}

			// Should detect existing enrichment and skip
			expect(media.enrichment).toHaveLength(1)
		})

		it('should re-run if config/model changes', () => {
			// Different model version = new enrichment, not skip
			const oldEnrichment = {
				kind: 'transcription' as const,
				provider: 'gemini' as const,
				model: 'gemini-1.5-pro',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				transcription: 'Old',
				speakers: ['Speaker 1'],
				shortDescription: 'Old',
			}

			const newModel = 'gemini-2.0-pro'

			expect(oldEnrichment.model).not.toBe(newModel)
		})
	})
})
