/**
 * Enrichment Idempotency Integration Tests
 *
 * Tests that verify idempotency works correctly when integrated with
 * actual enrichment providers (mocked).
 *
 * Simulates multi-run scenarios:
 * - Run 1: Enrich with image analysis
 * - Run 2: Add transcription + image already exists, should not duplicate
 * - Run 3: Force-refresh image analysis
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
	addEnrichmentIdempotent,
	deduplicateEnrichmentByKind,
	shouldSkipEnrichment,
} from '../idempotency'

import type { MediaEnrichment, Message } from '#schema/message'

describe('Enrichment Idempotency - Integration Scenarios', () => {
	let mediaMessage: Message

	beforeEach(() => {
		mediaMessage = {
			guid: 'msg-001',
			messageKind: 'media',
			isFromMe: true,
			date: '2025-10-17T10:00:00.000Z',
			media: {
				id: 'media-001',
				filename: 'photo.jpg',
				path: '/attachments/photo.jpg',
				mediaKind: 'image',
				enrichment: [],
			},
		}
	})

	describe('Scenario 1: Sequential Enrichment Runs', () => {
		it('should handle 3 sequential enrichment runs without duplicates', () => {
			// Run 1: Add image analysis
			const imageEnrichment: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:05:00.000Z',
				visionSummary: 'A photo of a mountain landscape',
				shortDescription: 'Mountain photo',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment, { forceRefresh: false })
			expect(mediaMessage.media?.enrichment).toHaveLength(1)

			// Run 2: Try to add same image analysis again (should skip)
			const imageEnrichment2: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '2.0',
				createdAt: '2025-10-17T10:10:00.000Z',
				visionSummary: 'Different analysis',
				shortDescription: 'Different',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment2, {
				forceRefresh: false,
			})
			expect(mediaMessage.media?.enrichment).toHaveLength(1)
			// Should still have original
			expect(mediaMessage.media?.enrichment?.[0].visionSummary).toBe(
				'A photo of a mountain landscape',
			)

			// Run 3: Add transcription (different kind, should add)
			const transcriptionEnrichment: MediaEnrichment = {
				kind: 'transcription',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:15:00.000Z',
				transcript: 'Audio transcription from the photo',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, transcriptionEnrichment, {
				forceRefresh: false,
			})
			expect(mediaMessage.media?.enrichment).toHaveLength(2)
		})

		it('should handle force-refresh override in sequential runs', () => {
			// Run 1: Add image analysis
			const imageEnrichment1: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:05:00.000Z',
				visionSummary: 'Original analysis',
				shortDescription: 'Original',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment1, {
				forceRefresh: false,
			})
			expect(mediaMessage.media?.enrichment?.[0].visionSummary).toBe('Original analysis')

			// Run 2: Try to add same kind with force-refresh
			const imageEnrichment2: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '2.0',
				createdAt: '2025-10-17T10:10:00.000Z',
				visionSummary: 'Updated analysis',
				shortDescription: 'Updated',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment2, { forceRefresh: true })
			expect(mediaMessage.media?.enrichment).toHaveLength(1)
			expect(mediaMessage.media?.enrichment?.[0].visionSummary).toBe('Updated analysis')
			expect(mediaMessage.media?.enrichment?.[0].version).toBe('2.0')
		})
	})

	describe('Scenario 2: Complex Multi-Provider Enrichment', () => {
		it('should manage enrichments from multiple providers', () => {
			// Simulate running multiple providers in a pipeline

			// Provider 1: Image Analysis (Gemini)
			const imageEnrichment: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:05:00.000Z',
				visionSummary: 'Mountain landscape photo',
				shortDescription: 'Mountain',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment, { forceRefresh: false })

			// Provider 2: Link Analysis (via Firecrawl, if image contains URL)
			const linkEnrichment: MediaEnrichment = {
				kind: 'link_context',
				provider: 'firecrawl',
				version: '1.0',
				createdAt: '2025-10-17T10:10:00.000Z',
				url: 'https://example.com',
				title: 'Example Website',
				summary: 'Helpful content',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, linkEnrichment, { forceRefresh: false })

			// Provider 3: Video Metadata (if applicable)
			const videoEnrichment: MediaEnrichment = {
				kind: 'video_metadata',
				provider: 'local',
				version: '1.0',
				createdAt: '2025-10-17T10:15:00.000Z',
				videoMetadata: {
					filename: 'video.mp4',
					duration: 120,
					analyzed: false,
					note: 'Video copied, no analysis',
				},
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, videoEnrichment, { forceRefresh: false })

			// Should have all three
			expect(mediaMessage.media?.enrichment).toHaveLength(3)

			const kinds = new Set(mediaMessage.media?.enrichment?.map((e) => e.kind))
			expect(kinds.has('image_analysis')).toBe(true)
			expect(kinds.has('link_context')).toBe(true)
			expect(kinds.has('video_metadata')).toBe(true)
		})
	})

	describe('Scenario 3: Pipeline Restart After Failure', () => {
		it('should resume enrichment pipeline without duplicating completed work', () => {
			// Simulate partial enrichment completion

			// Step 1: Image analysis completed
			const imageEnrichment: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:05:00.000Z',
				visionSummary: 'Photo',
				shortDescription: 'Photo',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment, { forceRefresh: false })

			// Simulate pipeline restart - try all enrichments again
			// Image should be skipped (already exists)
			const shouldSkipImage = shouldSkipEnrichment(mediaMessage, 'image_analysis')
			expect(shouldSkipImage).toBe(true)

			// Transcription should not be skipped
			const shouldSkipTranscription = shouldSkipEnrichment(mediaMessage, 'transcription')
			expect(shouldSkipTranscription).toBe(false)

			// Add transcription
			const transcriptionEnrichment: MediaEnrichment = {
				kind: 'transcription',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:10:00.000Z',
				transcript: 'Transcription',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, transcriptionEnrichment, {
				forceRefresh: false,
			})

			// Should have both, no duplicates
			expect(mediaMessage.media?.enrichment).toHaveLength(2)
		})
	})

	describe('Scenario 4: Deduplication After Merge', () => {
		it('should handle deduplication when merging enrichments from different sources', () => {
			// Simulate importing message from two different enrichment runs

			const baseEnrichments: MediaEnrichment[] = [
				{
					kind: 'image_analysis',
					provider: 'gemini',
					version: '1.0',
					createdAt: '2025-10-17T08:00:00.000Z',
					visionSummary: 'Old analysis',
					shortDescription: 'Old',
				},
				{
					kind: 'link_context',
					provider: 'firecrawl',
					version: '1.0',
					createdAt: '2025-10-17T08:30:00.000Z',
					url: 'https://example.com',
					title: 'Example',
				},
			]

			mediaMessage.media!.enrichment = baseEnrichments

			// Simulate receiving updated enrichments from another source
			const newEnrichments: MediaEnrichment[] = [
				{
					kind: 'image_analysis',
					provider: 'gemini',
					version: '2.0', // Newer version
					createdAt: '2025-10-17T10:00:00.000Z',
					visionSummary: 'New analysis',
					shortDescription: 'New',
				},
				{
					kind: 'transcription',
					provider: 'gemini',
					version: '1.0',
					createdAt: '2025-10-17T10:05:00.000Z',
					transcript: 'New transcription',
				},
			]

			// Merge and deduplicate
			const merged = [...baseEnrichments, ...newEnrichments]
			const deduped = deduplicateEnrichmentByKind(merged)

			expect(deduped).toHaveLength(3) // image_analysis, link_context, transcription

			const imageAnalysis = deduped.find((e) => e.kind === 'image_analysis')
			expect(imageAnalysis?.versionSummary).not.toBe('Old analysis')
			expect(imageAnalysis?.version).toBe('2.0') // Should have newer

			const transcription = deduped.find((e) => e.kind === 'transcription')
			expect(transcription?.transcript).toBe('New transcription')

			const linkContext = deduped.find((e) => e.kind === 'link_context')
			expect(linkContext?.title).toBe('Example')
		})
	})

	describe('Scenario 5: Error Recovery', () => {
		it('should handle enrichment when provider fails', () => {
			// Simulate provider failure scenario

			// Add initial enrichment (success)
			const imageEnrichment: MediaEnrichment = {
				kind: 'image_analysis',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:05:00.000Z',
				visionSummary: 'Success',
				shortDescription: 'Success',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, imageEnrichment, { forceRefresh: false })
			expect(mediaMessage.media?.enrichment).toHaveLength(1)

			// Simulate link enrichment failure (provider returned error)
			const failedLinkEnrichment: MediaEnrichment = {
				kind: 'link_context',
				provider: 'generic',
				version: '1.0',
				createdAt: '2025-10-17T10:10:00.000Z',
				error: 'Failed to fetch link context',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, failedLinkEnrichment, {
				forceRefresh: false,
			})

			// Should have both (error enrichment is still recorded)
			expect(mediaMessage.media?.enrichment).toHaveLength(2)

			// Retry transcription (different kind)
			const transcriptionEnrichment: MediaEnrichment = {
				kind: 'transcription',
				provider: 'gemini',
				version: '1.0',
				createdAt: '2025-10-17T10:15:00.000Z',
				transcript: 'Transcription',
			}

			mediaMessage = addEnrichmentIdempotent(mediaMessage, transcriptionEnrichment, {
				forceRefresh: false,
			})

			// Should have three total
			expect(mediaMessage.media?.enrichment).toHaveLength(3)
		})
	})
})
