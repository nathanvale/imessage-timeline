/**
 * Enrichment Idempotency Tests (ENRICH--T05)
 *
 * Tests for AC01-AC04:
 * - AC01: Skip enrichment if media.enrichment already contains entry with matching kind
 * - AC02: Deduplicate enrichment array by kind before adding new entries
 * - AC03: Re-running enrich-ai does not create duplicate entries (verified with tests)
 * - AC04: Support --force-refresh flag to override idempotency and re-enrich
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Message, MediaEnrichment } from '#schema/message'
import {
  shouldSkipEnrichment,
  deduplicateEnrichmentByKind,
  addEnrichmentIdempotent,
  hasAllEnrichments,
  getEnrichmentByKind,
  clearEnrichmentByKind,
  addEnrichmentsIdempotent,
} from '../idempotency'

describe('Enrichment Idempotency (ENRICH--T05)', () => {
  let mediaMessage: Message

  beforeEach(() => {
    mediaMessage = {
      guid: 'test-guid-1',
      messageKind: 'media',
      isFromMe: true,
      date: '2025-10-17T10:00:00.000Z',
      media: {
        id: 'media-id-1',
        filename: 'test.jpg',
        path: '/path/to/test.jpg',
        enrichment: [],
      },
    }
  })

  describe('AC01: Skip enrichment if matching kind exists', () => {
    it('should skip if enrichment with same kind already exists', () => {
      const existingEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T09:00:00.000Z',
        visionSummary: 'Test image',
        shortDescription: 'Test',
      }

      mediaMessage.media!.enrichment = [existingEnrichment]

      const result = shouldSkipEnrichment(mediaMessage, 'image_analysis')
      expect(result).toBe(true)
    })

    it('should not skip if enrichment kind does not exist', () => {
      const existingEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T09:00:00.000Z',
        visionSummary: 'Test image',
        shortDescription: 'Test',
      }

      mediaMessage.media!.enrichment = [existingEnrichment]

      const result = shouldSkipEnrichment(mediaMessage, 'transcription')
      expect(result).toBe(false)
    })

    it('should not skip if enrichment array is empty', () => {
      mediaMessage.media!.enrichment = []

      const result = shouldSkipEnrichment(mediaMessage, 'image_analysis')
      expect(result).toBe(false)
    })

    it('should not skip if enrichment is undefined', () => {
      mediaMessage.media!.enrichment = undefined

      const result = shouldSkipEnrichment(mediaMessage, 'image_analysis')
      expect(result).toBe(false)
    })

    it('should not skip if media is missing', () => {
      mediaMessage.media = null

      const result = shouldSkipEnrichment(mediaMessage, 'image_analysis')
      expect(result).toBe(false)
    })

    it('should skip if multiple enrichments exist with matching kind', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'link_context',
          provider: 'firecrawl',
          version: '1.0',
          createdAt: '2025-10-17T08:00:00.000Z',
          url: 'https://example.com',
          title: 'Example',
        },
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T09:00:00.000Z',
          visionSummary: 'Test image',
          shortDescription: 'Test',
        },
        {
          kind: 'transcription',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T09:30:00.000Z',
          transcript: 'Test transcript',
        },
      ]

      mediaMessage.media!.enrichment = enrichments

      const result = shouldSkipEnrichment(mediaMessage, 'image_analysis')
      expect(result).toBe(true)
    })
  })

  describe('AC02: Deduplicate enrichment array by kind', () => {
    it('should remove duplicate enrichments with same kind, keeping latest', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T08:00:00.000Z',
          visionSummary: 'Old analysis',
          shortDescription: 'Old',
        },
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '2.0',
          createdAt: '2025-10-17T10:00:00.000Z',
          visionSummary: 'New analysis',
          shortDescription: 'New',
        },
      ]

      const result = deduplicateEnrichmentByKind(enrichments)

      expect(result).toHaveLength(1)
      expect(result[0].visionSummary).toBe('New analysis')
      expect(result[0].version).toBe('2.0')
    })

    it('should keep all enrichments if no duplicates', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T08:00:00.000Z',
          visionSummary: 'Image',
          shortDescription: 'Image',
        },
        {
          kind: 'transcription',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T09:00:00.000Z',
          transcript: 'Audio transcript',
        },
        {
          kind: 'link_context',
          provider: 'firecrawl',
          version: '1.0',
          createdAt: '2025-10-17T09:30:00.000Z',
          url: 'https://example.com',
          title: 'Example',
        },
      ]

      const result = deduplicateEnrichmentByKind(enrichments)

      expect(result).toHaveLength(3)
    })

    it('should handle empty array', () => {
      const result = deduplicateEnrichmentByKind([])
      expect(result).toHaveLength(0)
    })

    it('should handle multiple duplicates of different kinds', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T08:00:00.000Z',
          visionSummary: 'Image 1',
          shortDescription: 'Image 1',
        },
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.5',
          createdAt: '2025-10-17T08:30:00.000Z',
          visionSummary: 'Image 2',
          shortDescription: 'Image 2',
        },
        {
          kind: 'transcription',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T09:00:00.000Z',
          transcript: 'Audio 1',
        },
        {
          kind: 'transcription',
          provider: 'gemini',
          version: '1.5',
          createdAt: '2025-10-17T09:30:00.000Z',
          transcript: 'Audio 2',
        },
      ]

      const result = deduplicateEnrichmentByKind(enrichments)

      expect(result).toHaveLength(2)
      // Should keep latest of each kind
      const imageAnalysis = result.find((e) => e.kind === 'image_analysis')
      const transcription = result.find((e) => e.kind === 'transcription')

      expect(imageAnalysis?.visionSummary).toBe('Image 2')
      expect(transcription?.transcript).toBe('Audio 2')
    })
  })

  describe('AC03: Re-running enrich-ai does not create duplicates', () => {
    it('should not add enrichment if kind already exists', () => {
      const existingEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T09:00:00.000Z',
        visionSummary: 'Test image',
        shortDescription: 'Test',
      }

      mediaMessage.media!.enrichment = [existingEnrichment]

      const newEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        visionSummary: 'New analysis',
        shortDescription: 'New',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: false })

      expect(result.media?.enrichment).toHaveLength(1)
      expect(result.media?.enrichment?.[0].visionSummary).toBe('Test image')
    })

    it('should add enrichment if kind does not exist', () => {
      const existingEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T09:00:00.000Z',
        visionSummary: 'Test image',
        shortDescription: 'Test',
      }

      mediaMessage.media!.enrichment = [existingEnrichment]

      const newEnrichment: MediaEnrichment = {
        kind: 'transcription',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        transcript: 'Audio transcript',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: false })

      expect(result.media?.enrichment).toHaveLength(2)
      const transcription = result.media?.enrichment?.find((e) => e.kind === 'transcription')
      expect(transcription?.transcript).toBe('Audio transcript')
    })

    it('should initialize enrichment array if missing', () => {
      mediaMessage.media!.enrichment = undefined

      const newEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        visionSummary: 'Test image',
        shortDescription: 'Test',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: false })

      expect(result.media?.enrichment).toHaveLength(1)
      expect(result.media?.enrichment?.[0].kind).toBe('image_analysis')
    })

    it('should not crash if media is null', () => {
      mediaMessage.media = null

      const newEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        visionSummary: 'Test image',
        shortDescription: 'Test',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: false })

      expect(result.media).toBeNull()
      expect(result.guid).toBe('test-guid-1')
    })
  })

  describe('AC04: Support --force-refresh flag', () => {
    it('should replace enrichment if force-refresh is true', () => {
      const existingEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T09:00:00.000Z',
        visionSummary: 'Old analysis',
        shortDescription: 'Old',
      }

      mediaMessage.media!.enrichment = [existingEnrichment]

      const newEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '2.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        visionSummary: 'New analysis',
        shortDescription: 'New',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: true })

      expect(result.media?.enrichment).toHaveLength(1)
      expect(result.media?.enrichment?.[0].visionSummary).toBe('New analysis')
      expect(result.media?.enrichment?.[0].version).toBe('2.0')
    })

    it('should still add non-duplicate enrichments with force-refresh', () => {
      const existingEnrichments: MediaEnrichment[] = [
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T09:00:00.000Z',
          visionSummary: 'Image',
          shortDescription: 'Image',
        },
        {
          kind: 'link_context',
          provider: 'firecrawl',
          version: '1.0',
          createdAt: '2025-10-17T09:30:00.000Z',
          url: 'https://example.com',
          title: 'Example',
        },
      ]

      mediaMessage.media!.enrichment = existingEnrichments

      const newEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '2.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        visionSummary: 'New image analysis',
        shortDescription: 'New',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: true })

      expect(result.media?.enrichment).toHaveLength(2)
      const imageAnalysis = result.media?.enrichment?.find((e) => e.kind === 'image_analysis')
      const linkContext = result.media?.enrichment?.find((e) => e.kind === 'link_context')

      expect(imageAnalysis?.visionSummary).toBe('New image analysis')
      expect(linkContext?.title).toBe('Example')
    })

    it('should respect force-refresh=false (default idempotent behavior)', () => {
      const existingEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T09:00:00.000Z',
        visionSummary: 'Original',
        shortDescription: 'Original',
      }

      mediaMessage.media!.enrichment = [existingEnrichment]

      const newEnrichment: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '2.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        visionSummary: 'New',
        shortDescription: 'New',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: false })

      expect(result.media?.enrichment).toHaveLength(1)
      expect(result.media?.enrichment?.[0].visionSummary).toBe('Original')
    })
  })

  describe('Integration: Multiple operations', () => {
    it('should handle complex scenario with dedupe and idempotency', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.0',
          createdAt: '2025-10-17T08:00:00.000Z',
          visionSummary: 'Image 1',
          shortDescription: 'Image 1',
        },
        {
          kind: 'image_analysis',
          provider: 'gemini',
          version: '1.5',
          createdAt: '2025-10-17T08:30:00.000Z',
          visionSummary: 'Image 2',
          shortDescription: 'Image 2',
        },
        {
          kind: 'link_context',
          provider: 'firecrawl',
          version: '1.0',
          createdAt: '2025-10-17T09:00:00.000Z',
          url: 'https://example.com',
          title: 'Example',
        },
      ]

      mediaMessage.media!.enrichment = enrichments

      const newEnrichment: MediaEnrichment = {
        kind: 'transcription',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T10:00:00.000Z',
        transcript: 'Audio transcript',
      }

      const result = addEnrichmentIdempotent(mediaMessage, newEnrichment, { forceRefresh: false })

      // Should have deduplicated image_analysis (kept latest), link_context, and added transcription
      expect(result.media?.enrichment).toHaveLength(3)

      const imageAnalysis = result.media?.enrichment?.find((e) => e.kind === 'image_analysis')
      expect(imageAnalysis?.visionSummary).toBe('Image 2') // Latest

      const transcription = result.media?.enrichment?.find((e) => e.kind === 'transcription')
      expect(transcription?.transcript).toBe('Audio transcript')

      const linkContext = result.media?.enrichment?.find((e) => e.kind === 'link_context')
      expect(linkContext?.title).toBe('Example')
    })

    it('should verify no duplicates after multiple re-runs', () => {
      mediaMessage.media!.enrichment = []

      const enrichment1: MediaEnrichment = {
        kind: 'image_analysis',
        provider: 'gemini',
        version: '1.0',
        createdAt: '2025-10-17T08:00:00.000Z',
        visionSummary: 'Analysis 1',
        shortDescription: 'Analysis 1',
      }

      // First run
      let result = addEnrichmentIdempotent(mediaMessage, enrichment1, { forceRefresh: false })
      expect(result.media?.enrichment).toHaveLength(1)

      // Second run (same kind)
      result = addEnrichmentIdempotent(result, enrichment1, { forceRefresh: false })
      expect(result.media?.enrichment).toHaveLength(1) // No duplicate

      // Third run (same kind)
      result = addEnrichmentIdempotent(result, enrichment1, { forceRefresh: false })
      expect(result.media?.enrichment).toHaveLength(1) // Still no duplicate
    })
  })

  describe('Helper Functions', () => {
    describe('hasAllEnrichments', () => {
      it('should return true when all required enrichments exist', () => {
        const enrichments: MediaEnrichment[] = [
          {
            kind: 'image_analysis',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T08:00:00.000Z',
            visionSummary: 'Image',
            shortDescription: 'Image',
          },
          {
            kind: 'transcription',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T09:00:00.000Z',
            transcript: 'Audio',
          },
        ]

        mediaMessage.media!.enrichment = enrichments

        const result = hasAllEnrichments(mediaMessage, ['image_analysis', 'transcription'])
        expect(result).toBe(true)
      })

      it('should return false when some required enrichments are missing', () => {
        const enrichments: MediaEnrichment[] = [
          {
            kind: 'image_analysis',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T08:00:00.000Z',
            visionSummary: 'Image',
            shortDescription: 'Image',
          },
        ]

        mediaMessage.media!.enrichment = enrichments

        const result = hasAllEnrichments(mediaMessage, ['image_analysis', 'transcription'])
        expect(result).toBe(false)
      })

      it('should return false if no enrichments', () => {
        mediaMessage.media!.enrichment = undefined

        const result = hasAllEnrichments(mediaMessage, ['image_analysis'])
        expect(result).toBe(false)
      })
    })

    describe('getEnrichmentByKind', () => {
      it('should return enrichment when kind exists', () => {
        const enrichments: MediaEnrichment[] = [
          {
            kind: 'image_analysis',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T08:00:00.000Z',
            visionSummary: 'Test image',
            shortDescription: 'Test',
          },
          {
            kind: 'transcription',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T09:00:00.000Z',
            transcript: 'Test audio',
          },
        ]

        mediaMessage.media!.enrichment = enrichments

        const result = getEnrichmentByKind(mediaMessage, 'image_analysis')
        expect(result?.kind).toBe('image_analysis')
        expect(result?.visionSummary).toBe('Test image')
      })

      it('should return undefined when kind does not exist', () => {
        const enrichments: MediaEnrichment[] = [
          {
            kind: 'image_analysis',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T08:00:00.000Z',
            visionSummary: 'Test',
            shortDescription: 'Test',
          },
        ]

        mediaMessage.media!.enrichment = enrichments

        const result = getEnrichmentByKind(mediaMessage, 'transcription')
        expect(result).toBeUndefined()
      })

      it('should return undefined if no enrichments', () => {
        mediaMessage.media!.enrichment = undefined

        const result = getEnrichmentByKind(mediaMessage, 'image_analysis')
        expect(result).toBeUndefined()
      })
    })

    describe('clearEnrichmentByKind', () => {
      it('should remove enrichment of specified kind', () => {
        const enrichments: MediaEnrichment[] = [
          {
            kind: 'image_analysis',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T08:00:00.000Z',
            visionSummary: 'Test image',
            shortDescription: 'Test',
          },
          {
            kind: 'transcription',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T09:00:00.000Z',
            transcript: 'Test audio',
          },
        ]

        mediaMessage.media!.enrichment = enrichments

        const result = clearEnrichmentByKind(mediaMessage, 'image_analysis')

        expect(result.media?.enrichment).toHaveLength(1)
        expect(result.media?.enrichment?.[0].kind).toBe('transcription')
      })

      it('should clear all enrichments if only one kind exists', () => {
        const enrichments: MediaEnrichment[] = [
          {
            kind: 'image_analysis',
            provider: 'gemini',
            version: '1.0',
            createdAt: '2025-10-17T08:00:00.000Z',
            visionSummary: 'Test',
            shortDescription: 'Test',
          },
        ]

        mediaMessage.media!.enrichment = enrichments

        const result = clearEnrichmentByKind(mediaMessage, 'image_analysis')

        expect(result.media?.enrichment).toBeUndefined()
      })

      it('should not crash if enrichment does not exist', () => {
        mediaMessage.media!.enrichment = undefined

        const result = clearEnrichmentByKind(mediaMessage, 'image_analysis')

        expect(result.media?.enrichment).toBeUndefined()
      })
    })

    describe('addEnrichmentsIdempotent', () => {
      it('should add enrichments to multiple messages', () => {
        const message2: Message = {
          guid: 'test-guid-2',
          messageKind: 'media',
          isFromMe: true,
          date: '2025-10-17T11:00:00.000Z',
          media: {
            id: 'media-id-2',
            filename: 'test2.jpg',
            path: '/path/to/test2.jpg',
            enrichment: [],
          },
        }

        const enrichments = new Map<string, MediaEnrichment>([
          [
            'test-guid-1',
            {
              kind: 'image_analysis',
              provider: 'gemini',
              version: '1.0',
              createdAt: '2025-10-17T08:00:00.000Z',
              visionSummary: 'Image 1',
              shortDescription: 'Image 1',
            },
          ],
          [
            'test-guid-2',
            {
              kind: 'transcription',
              provider: 'gemini',
              version: '1.0',
              createdAt: '2025-10-17T09:00:00.000Z',
              transcript: 'Audio 2',
            },
          ],
        ])

        const results = addEnrichmentsIdempotent([mediaMessage, message2], enrichments, {
          forceRefresh: false,
        })

        expect(results).toHaveLength(2)
        expect(results[0].media?.enrichment).toHaveLength(1)
        expect(results[0].media?.enrichment?.[0].kind).toBe('image_analysis')
        expect(results[1].media?.enrichment).toHaveLength(1)
        expect(results[1].media?.enrichment?.[0].kind).toBe('transcription')
      })

      it('should skip messages without enrichments in map', () => {
        const message2: Message = {
          guid: 'test-guid-2',
          messageKind: 'media',
          isFromMe: true,
          date: '2025-10-17T11:00:00.000Z',
          media: {
            id: 'media-id-2',
            filename: 'test2.jpg',
            path: '/path/to/test2.jpg',
            enrichment: [],
          },
        }

        const enrichments = new Map<string, MediaEnrichment>([
          [
            'test-guid-1',
            {
              kind: 'image_analysis',
              provider: 'gemini',
              version: '1.0',
              createdAt: '2025-10-17T08:00:00.000Z',
              visionSummary: 'Image 1',
              shortDescription: 'Image 1',
            },
          ],
        ])

        const results = addEnrichmentsIdempotent([mediaMessage, message2], enrichments, {
          forceRefresh: false,
        })

        expect(results).toHaveLength(2)
        expect(results[0].media?.enrichment).toHaveLength(1)
        expect(results[1].media?.enrichment).toHaveLength(0) // No enrichment added
      })
    })
  })
})
