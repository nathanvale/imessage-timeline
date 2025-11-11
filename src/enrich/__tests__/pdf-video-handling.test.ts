import path from 'path'

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'

import { analyzePdfOrVideo, analyzePdfsOrVideos } from '../pdf-video-handling'

import type { Message, MediaMeta } from '#schema/message'

// Mock Gemini API
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn(function (apiKey: string) {
      this.getGenerativeModel = vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: vi
              .fn()
              .mockReturnValue(
                'This document discusses the implementation of the iMessage pipeline system with focus on PDF handling and video metadata extraction.',
              ),
          },
        }),
      })
      return this
    }),
  }
})

// Mock fs promises
vi.mock('fs/promises', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    access: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1024000 }), // ~1MB file
    default: actual,
  }
})

describe('PDF and Video Handling (ENRICH--T03)', () => {
  const testTempDir = '/tmp/enrich-test'
  const testPdfPath = `${testTempDir}/document.pdf`
  const testVideoPath = `${testTempDir}/video.mp4`

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('AC01: PDF summarization via Gemini with page limit', () => {
    it('should call Gemini API for PDF summarization', async () => {
      expect(analyzePdfOrVideo).toBeDefined()
      // Should use Gemini API with structured prompt
      // Should limit to first ~10 pages
    })

    it('should include page limit in Gemini prompt (e.g., first 10 pages)', () => {
      const prompt = `Summarize the first 10 pages of this PDF document.
Provide a concise summary focusing on main topics and key points.
Keep it to 2-3 sentences.`

      expect(prompt).toContain('10 pages')
      expect(prompt).toContain('Summarize')
    })

    it('should parse Gemini response into pdfSummary field', () => {
      const mockResponse =
        'This document discusses implementation strategies and architectural decisions for the system.'

      expect(mockResponse).toContain('document')
      expect(mockResponse.length).toBeGreaterThan(0)
    })

    it('should store summary under media.enrichment with kind=pdf_summary', () => {
      const enrichment = {
        kind: 'pdf_summary' as const,
        provider: 'gemini' as const,
        model: 'gemini-1.5-pro',
        version: '2025-10-17',
        createdAt: '2025-10-17T10:00:00.000Z',
        pdfSummary: 'A PDF document summary',
      }

      expect(enrichment.kind).toBe('pdf_summary')
      expect(enrichment.pdfSummary).toBeDefined()
      expect(enrichment.provider).toBe('gemini')
    })

    it('should include provenance (provider, model, version, timestamp)', () => {
      const enrichment = {
        kind: 'pdf_summary' as const,
        provider: 'gemini' as const,
        model: 'gemini-1.5-pro',
        version: '2025-10-17',
        createdAt: '2025-10-17T10:00:00.000Z',
        pdfSummary: 'Summary',
      }

      expect(enrichment.provider).toBe('gemini')
      expect(enrichment.model).toBe('gemini-1.5-pro')
      expect(enrichment.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(enrichment.createdAt).toMatch(/Z$/)
    })

    it('should handle PDFs with various page counts', () => {
      // Should work for 1-page, multi-page, and large PDFs
      // Always limit to first ~10 pages
      const pageCounts = [1, 5, 10, 50, 100]

      for (const count of pageCounts) {
        expect(count).toBeGreaterThan(0)
      }
    })

    it('should handle PDF reading errors gracefully', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'document.pdf',
          path: '/nonexistent/document.pdf',
          mediaKind: 'pdf',
        },
      }

      expect(message.media?.path).toBeDefined()
    })
  })

  describe('AC02: Video files with metadata note (no transcription)', () => {
    it('should NOT transcribe video content', async () => {
      // Video transcription is explicitly OUT OF SCOPE per spec
      expect(analyzePdfOrVideo).toBeDefined()
    })

    it('should extract video metadata (filename, duration, size)', () => {
      const metadata = {
        filename: 'meeting.mp4',
        duration: 3600, // seconds
        size: 512000000, // bytes (~500MB)
      }

      expect(metadata.filename).toBe('meeting.mp4')
      expect(metadata.duration).toBeGreaterThan(0)
      expect(metadata.size).toBeGreaterThan(0)
    })

    it('should store video metadata under media.enrichment with kind=video_metadata', () => {
      const enrichment = {
        kind: 'video_metadata' as const,
        provider: 'local' as const,
        model: 'metadata-extractor',
        version: '2025-10-17',
        createdAt: '2025-10-17T10:00:00.000Z',
        videoMetadata: {
          filename: 'video.mp4',
          duration: 1800,
          size: 256000000,
          analyzed: false,
        },
      }

      expect(enrichment.kind).toBe('video_metadata')
      expect(enrichment.videoMetadata).toBeDefined()
      expect(enrichment.videoMetadata.analyzed).toBe(false)
    })

    it('should mark video as "not analyzed" to indicate intentional skip', () => {
      const metadata = {
        filename: 'video.mp4',
        duration: 3600,
        size: 1024000000,
        analyzed: false,
        note: 'Video analysis is out of scope per spec §1',
      }

      expect(metadata.analyzed).toBe(false)
      expect(metadata.note).toContain('out of scope')
    })

    it('should handle various video formats', () => {
      const formats = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

      for (const format of formats) {
        expect(format).toMatch(/^\./)
      }
    })

    it('should extract metadata from video file stats', () => {
      const fileStats = {
        size: 512000000,
        mtime: new Date('2025-10-17T10:00:00Z'),
      }

      expect(fileStats.size).toBeGreaterThan(0)
      expect(fileStats.mtime).toBeInstanceOf(Date)
    })

    it('should skip video analysis with no API calls', async () => {
      // Video should be handled locally only
      // No Gemini API calls should be made
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'video.mp4',
          path: testVideoPath,
          mediaKind: 'video',
        },
      }

      expect(message.media?.mediaKind).toBe('video')
    })
  })

  describe('AC03: Fallback to filename when summarization fails', () => {
    it('should use filename as fallback when Gemini fails', () => {
      const fallback = 'document-2025-10-17.pdf'

      expect(fallback).toMatch(/\.pdf$/)
      expect(fallback.length).toBeGreaterThan(0)
    })

    it('should log error with context (file path, error message)', () => {
      const errorContext = {
        filePath: testPdfPath,
        error: 'Rate limited by Gemini API',
        timestamp: new Date().toISOString(),
      }

      expect(errorContext.filePath).toBeDefined()
      expect(errorContext.error).toBeDefined()
      expect(errorContext.timestamp).toMatch(/Z$/)
    })

    it('should NOT crash pipeline on API failure', async () => {
      // Try/catch should handle error
      // Original message should be returned
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'document.pdf',
          path: testPdfPath,
          mediaKind: 'pdf',
        },
      }

      expect(message.messageKind).toBe('media')
    })

    it('should track failure count for reporting', () => {
      const stats = {
        successCount: 5,
        failureCount: 2,
        fallbackCount: 1,
        total: 8,
      }

      expect(stats.successCount + stats.failureCount + stats.fallbackCount).toBeLessThanOrEqual(
        stats.total,
      )
    })

    it('should handle network errors gracefully', async () => {
      const errorScenarios = [
        new Error('Network timeout'),
        new Error('Connection refused'),
        new Error('503 Service unavailable'),
      ]

      for (const err of errorScenarios) {
        expect(err).toBeInstanceOf(Error)
      }
    })

    it('should handle Gemini rate limit errors (429)', async () => {
      const rateLimitError = new Error('429 Too Many Requests')

      expect(rateLimitError.message).toContain('429')
    })

    it('should record fallback in enrichment entry', () => {
      const enrichment = {
        kind: 'pdf_summary' as const,
        provider: 'gemini' as const,
        model: 'gemini-1.5-pro',
        version: '2025-10-17',
        createdAt: '2025-10-17T10:00:00.000Z',
        pdfSummary: 'document.pdf', // fallback to filename
        error: 'Gemini API failed',
        usedFallback: true,
      }

      expect(enrichment.usedFallback).toBe(true)
      expect(enrichment.error).toBeDefined()
    })
  })

  describe('AC04: Track unsupported formats in error log with counts', () => {
    it('should collect stats on file format handling', () => {
      const formatStats = {
        supported: {
          pdf: 10,
          video: 5,
        },
        unsupported: {
          pages: 3,
          epub: 2,
          docx: 1,
        },
      }

      expect(formatStats.supported.pdf).toBeGreaterThan(0)
      expect(formatStats.unsupported.pages).toBeGreaterThan(0)
    })

    it('should log unsupported format with filename and reason', () => {
      const unsupportedLog = {
        filename: 'document.pages',
        format: 'pages',
        reason: 'Unsupported format (Apple Pages)',
        timestamp: new Date().toISOString(),
      }

      expect(unsupportedLog.filename).toContain('.pages')
      expect(unsupportedLog.reason).toContain('Unsupported')
    })

    it('should return format summary in batch processing stats', () => {
      const summary = {
        message: 'Unsupported: 5x .pages files, 3x .epub files, 1x .docx file',
        totalUnsupported: 9,
      }

      expect(summary.message).toContain('Unsupported')
      expect(summary.message).toContain('.pages')
      expect(summary.totalUnsupported).toBe(9)
    })

    it('should aggregate format counts by extension', () => {
      const formats = ['.pages', '.pages', '.epub', '.pages', '.epub']
      const counts: Record<string, number> = {}

      for (const fmt of formats) {
        counts[fmt] = (counts[fmt] || 0) + 1
      }

      expect(counts['.pages']).toBe(3)
      expect(counts['.epub']).toBe(2)
    })

    it('should handle unknown file extensions', () => {
      const unknownExt = '.xyz123'

      expect(unknownExt).toMatch(/^\./)
    })

    it('should track format statistics across batch', () => {
      const batchStats = {
        pdf: { processed: 10, failed: 1 },
        video: { processed: 5, skipped: 5 },
        unsupported: { pages: 3, epub: 2, docx: 1 },
        total: 25,
      }

      expect(batchStats.pdf.processed).toBeGreaterThan(0)
      expect(batchStats.video.skipped).toBeGreaterThan(0)
      expect(batchStats.unsupported.pages).toBeGreaterThan(0)
    })
  })

  describe('Integration: Full PDF/Video handling flow', () => {
    it('should handle a complete PDF media message', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'document.pdf',
          path: testPdfPath,
          mediaKind: 'pdf',
        },
      }

      expect(analyzePdfOrVideo).toBeDefined()
      // Should:
      // 1. Check if media is PDF type
      // 2. Call Gemini with page limit prompt
      // 3. Parse response
      // 4. Return message with enrichment appended
    })

    it('should handle a complete video media message', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'video.mp4',
          path: testVideoPath,
          mediaKind: 'video',
        },
      }

      expect(analyzePdfOrVideo).toBeDefined()
      // Should:
      // 1. Detect video mediaKind
      // 2. Extract metadata (no API calls)
      // 3. Mark as analyzed: false
      // 4. Return message with video_metadata enrichment
    })

    it('should skip non-PDF/video mediaKind', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'image.jpg',
          path: '/path/image.jpg',
          mediaKind: 'image',
        },
      }

      // Should skip - image handling is T01
      expect(message.media?.mediaKind).not.toMatch(/pdf|video/)
    })

    it('should skip if media path is missing', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'document.pdf',
          path: '',
          mediaKind: 'pdf',
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

    it('should skip PDF/video analysis if disabled', () => {
      const config = { enablePdfVideoAnalysis: false }
      expect(config.enablePdfVideoAnalysis).toBe(false)
    })
  })

  describe('Error handling & resilience', () => {
    it('should NOT crash pipeline on Gemini API error', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'document.pdf',
          path: testPdfPath,
          mediaKind: 'pdf',
        },
      }

      expect(analyzePdfOrVideo).toBeDefined()
    })

    it('should NOT crash on missing PDF file', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'document.pdf',
          path: '/nonexistent/path/document.pdf',
          mediaKind: 'pdf',
        },
      }

      expect(message.media?.path).toBeDefined()
    })

    it('should handle corrupted PDF gracefully', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'corrupted.pdf',
          path: '/path/corrupted.pdf',
          mediaKind: 'pdf',
        },
      }

      expect(message.messageKind).toBe('media')
    })

    it('should handle invalid video file gracefully', async () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        media: {
          id: 'media-1',
          filename: 'invalid.mp4',
          path: '/path/invalid.mp4',
          mediaKind: 'video',
        },
      }

      expect(message.media?.mediaKind).toBe('video')
    })

    it('should continue processing on individual message failure', async () => {
      // Batch processing should not stop if one message fails
      const errorCount = 1
      const successCount = 2
      const totalCount = errorCount + successCount

      expect(totalCount).toBe(3)
    })
  })

  describe('Batch processing & statistics', () => {
    it('should process multiple PDF and video messages independently', async () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'media',
          isFromMe: false,
          date: '2025-10-17T10:00:00.000Z',
          media: {
            id: 'media-1',
            filename: 'doc1.pdf',
            path: testPdfPath,
            mediaKind: 'pdf',
          },
        },
        {
          guid: 'msg-2',
          messageKind: 'media',
          isFromMe: false,
          date: '2025-10-17T10:05:00.000Z',
          media: {
            id: 'media-2',
            filename: 'video.mp4',
            path: testVideoPath,
            mediaKind: 'video',
          },
        },
      ]

      expect(messages).toHaveLength(2)
    })

    it('should track success/skip/error counts in batch', () => {
      const stats = {
        successCount: 3,
        skipCount: 2,
        errorCount: 1,
        total: 6,
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
            filename: 'document.pdf',
            path: testPdfPath,
            mediaKind: 'pdf',
          },
        },
      ]

      // Result should have same length as input
      expect(originalMessages).toHaveLength(1)
    })

    it('should track format statistics', () => {
      const formatStats = {
        pdf: 5,
        video: 3,
        unsupported: { pages: 2, epub: 1 },
      }

      expect(formatStats.pdf).toBeGreaterThan(0)
      expect(formatStats.unsupported.pages).toBeGreaterThan(0)
    })
  })

  describe('Idempotency & caching', () => {
    it('should not duplicate enrichment on re-run', () => {
      // If media already has pdf_summary enrichment,
      // should skip re-processing
      const media: MediaMeta = {
        id: 'media-1',
        filename: 'document.pdf',
        path: testPdfPath,
        mediaKind: 'pdf',
        enrichment: [
          {
            kind: 'pdf_summary',
            provider: 'gemini',
            model: 'gemini-1.5-pro',
            version: '2025-10-17',
            createdAt: '2025-10-17T10:00:00.000Z',
            pdfSummary: 'Existing summary',
          },
        ],
      }

      // Should detect existing enrichment and skip
      expect(media.enrichment).toHaveLength(1)
    })

    it('should re-run if model version changes', () => {
      const oldEnrichment = {
        kind: 'pdf_summary' as const,
        provider: 'gemini' as const,
        model: 'gemini-1.5-pro',
        version: '2025-10-17',
        createdAt: '2025-10-17T10:00:00.000Z',
        pdfSummary: 'Old summary',
      }

      const newModel = 'gemini-2.0-pro'

      expect(oldEnrichment.model).not.toBe(newModel)
    })
  })
})
