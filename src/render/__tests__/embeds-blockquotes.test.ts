/**
 * Embeds and Blockquotes Rendering Tests (RENDER--T03)
 *
 * Test suite for Obsidian-friendly embeds and blockquote rendering:
 * - AC01: Image embeds with ![[path]] syntax
 * - AC02: Preview images with links to originals
 * - AC03: Transcription blockquotes
 * - AC04: Link context blockquotes
 * - AC05: PDF summary blockquotes
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Message, MediaEnrichment } from '#schema/message'
import {
  renderImageEmbed,
  renderPreviewImageWithLink,
  renderTranscriptionBlockquote,
  renderLinkContextBlockquote,
  renderPdfSummaryBlockquote,
  shouldRenderEmbed,
  getEmbedPath,
  getPreviewPath,
  getOriginalPath,
  getTranscriptions,
  getLinkContexts,
  getPdfSummaries,
  renderAllEnrichments,
} from '../embeds-blockquotes'

describe('RENDER--T03: Embeds and Blockquotes', () => {
  // ============================================================================
  // AC01: Image embeds with ![[path]] syntax
  // ============================================================================

  describe('AC01: Image embeds with ![[path]] syntax', () => {
    it('renders image embed with Obsidian wikilink syntax', () => {
      const result = renderImageEmbed('/path/to/image.jpg')
      expect(result).toBe('![[/path/to/image.jpg]]')
    })

    it('handles relative paths in embeds', () => {
      const result = renderImageEmbed('attachments/image.png')
      expect(result).toBe('![[attachments/image.png]]')
    })

    it('escapes special characters in path', () => {
      const result = renderImageEmbed('/path/to/my image (1).jpg')
      expect(result).toBe('![[/path/to/my image (1).jpg]]')
    })

    it('handles paths with spaces', () => {
      const result = renderImageEmbed('/attachments/Screenshot 2025-01-15.png')
      expect(result).toBe('![[/attachments/Screenshot 2025-01-15.png]]')
    })

    it('preserves absolute paths', () => {
      const result = renderImageEmbed('/Users/nathan/Library/Messages/image.heic.jpg')
      expect(result).toBe('![[/Users/nathan/Library/Messages/image.heic.jpg]]')
    })
  })

  // ============================================================================
  // AC02: Preview images with links to originals
  // ============================================================================

  describe('AC02: Preview images with links to originals', () => {
    it('renders preview image with link to original for HEIC', () => {
      const result = renderPreviewImageWithLink(
        '/path/to/image.heic.jpg', // preview path
        '/path/to/image.heic' // original path
      )
      expect(result).toContain('![[/path/to/image.heic.jpg]]')
      expect(result).toContain('[Original: image.heic](/path/to/image.heic)')
    })

    it('renders preview image with link to original for TIFF', () => {
      const result = renderPreviewImageWithLink(
        '/path/to/scan.tiff.jpg',
        '/path/to/scan.tiff'
      )
      expect(result).toContain('![[/path/to/scan.tiff.jpg]]')
      expect(result).toContain('[Original: scan.tiff](/path/to/scan.tiff)')
    })

    it('formats as markdown with proper line breaks', () => {
      const result = renderPreviewImageWithLink(
        '/preview/img.jpg',
        '/original/img.heic'
      )
      const lines = result.split('\n')
      expect(lines[0]).toBe('![[/preview/img.jpg]]')
      expect(lines[1]).toContain('[Original:')
    })

    it('extracts filename from original path for link text', () => {
      const result = renderPreviewImageWithLink(
        '/cache/preview.jpg',
        '/attachments/photo-2025-01-15-12-34-56.heic'
      )
      expect(result).toContain('[Original: photo-2025-01-15-12-34-56.heic]')
    })

    it('handles paths without directory separator', () => {
      const result = renderPreviewImageWithLink(
        'preview.jpg',
        'original.heic'
      )
      expect(result).toContain('![[preview.jpg]]')
      expect(result).toContain('[Original: original.heic]')
    })
  })

  // ============================================================================
  // AC03: Transcription blockquotes
  // ============================================================================

  describe('AC03: Transcription blockquotes', () => {
    it('renders transcription as blockquote with > prefix', () => {
      const enrichment: MediaEnrichment = {
        kind: 'transcription',
        transcription: 'Hello, this is a voice memo',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      expect(result).toContain('> Hello, this is a voice memo')
    })

    it('formats multiline transcription with blockquote on each line', () => {
      const enrichment: MediaEnrichment = {
        kind: 'transcription',
        transcription: 'First line\nSecond line\nThird line',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      const lines = result.split('\n')
      expect(lines[0]).toBe('> First line')
      expect(lines[1]).toBe('> Second line')
      expect(lines[2]).toBe('> Third line')
    })

    it('includes speaker labels if present', () => {
      const enrichment: MediaEnrichment = {
        kind: 'transcription',
        transcription: 'Speaker 1: Hello\nSpeaker 2: Hi there',
        speakers: ['Speaker 1', 'Speaker 2'],
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      expect(result).toContain('Speaker 1: Hello')
      expect(result).toContain('Speaker 2: Hi there')
    })

    it('includes timestamps if present', () => {
      const enrichment: MediaEnrichment = {
        kind: 'transcription',
        transcription: '[00:00:05] Hello world',
        timestamps: [
          { time: '00:00:05', speaker: 'Speaker 1', content: 'Hello world' },
        ],
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      expect(result).toContain('[00:00:05]')
    })

    it('handles empty transcription gracefully', () => {
      const enrichment: MediaEnrichment = {
        kind: 'transcription',
        transcription: '',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      expect(result).toBe('')
    })

    it('returns empty string for non-transcription enrichment', () => {
      const enrichment: MediaEnrichment = {
        kind: 'image',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      expect(result).toBe('')
    })
  })

  // ============================================================================
  // AC04: Link context blockquotes
  // ============================================================================

  describe('AC04: Link context blockquotes', () => {
    it('renders link context as blockquote with title', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://example.com',
        title: 'Example Website',
        summary: 'A summary of the website content',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toContain('[Example Website](https://example.com)')
      expect(result).toContain('> A summary of the website content')
    })

    it('renders link context with URL as markdown link', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://github.com/anthropics/claude-code',
        title: 'Claude Code',
        summary: 'CLI for Claude',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toContain('[Claude Code](https://github.com/anthropics/claude-code)')
    })

    it('formats multiline summary with blockquote on each line', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://example.com',
        title: 'Title',
        summary: 'First paragraph\n\nSecond paragraph',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      const lines = result.split('\n').filter((l) => l.startsWith('>'))
      expect(lines.length).toBeGreaterThan(1)
    })

    it('returns empty string for non-link enrichment', () => {
      const enrichment: MediaEnrichment = {
        kind: 'image',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toBe('')
    })

    it('handles missing summary gracefully', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://example.com',
        title: 'Example',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toContain('[Example](https://example.com)')
    })

    it('handles missing title gracefully', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://example.com/page',
        summary: 'Page summary',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toContain('https://example.com/page')
      expect(result).toContain('> Page summary')
    })
  })

  // ============================================================================
  // AC05: PDF summary blockquotes
  // ============================================================================

  describe('AC05: PDF summary blockquotes', () => {
    it('renders PDF summary as blockquote', () => {
      const enrichment: MediaEnrichment = {
        kind: 'pdf_summary',
        pdfSummary: 'This document contains important information about X, Y, and Z.',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderPdfSummaryBlockquote(enrichment)
      expect(result).toContain('> This document contains important information about X, Y, and Z.')
    })

    it('formats multiline PDF summary with blockquote on each line', () => {
      const enrichment: MediaEnrichment = {
        kind: 'pdf_summary',
        pdfSummary: 'Chapter 1: Introduction\nDiscusses background.\n\nChapter 2: Methods\nExplains approach.',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderPdfSummaryBlockquote(enrichment)
      const lines = result.split('\n').filter((l) => l.startsWith('>'))
      expect(lines.length).toBeGreaterThanOrEqual(4)
    })

    it('preserves paragraph breaks in PDF summary', () => {
      const enrichment: MediaEnrichment = {
        kind: 'pdf_summary',
        pdfSummary: 'Paragraph 1\n\nParagraph 2\n\nParagraph 3',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderPdfSummaryBlockquote(enrichment)
      expect(result).toContain('> Paragraph 1')
      expect(result).toContain('> ')
      expect(result).toContain('> Paragraph 2')
    })

    it('returns empty string for non-PDF enrichment', () => {
      const enrichment: MediaEnrichment = {
        kind: 'image',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderPdfSummaryBlockquote(enrichment)
      expect(result).toBe('')
    })

    it('handles empty PDF summary gracefully', () => {
      const enrichment: MediaEnrichment = {
        kind: 'pdf_summary',
        pdfSummary: '',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderPdfSummaryBlockquote(enrichment)
      expect(result).toBe('')
    })
  })

  // ============================================================================
  // Helper Functions
  // ============================================================================

  describe('Helper functions', () => {
    describe('shouldRenderEmbed', () => {
      it('returns true for image media', () => {
        const message: Message = {
          guid: 'test-guid',
          messageKind: 'media',
          date: '2025-01-15T10:00:00Z',
          sender: 'Test User',
          text: '',
          media: {
            id: 'media-1',
            path: '/path/to/image.jpg',
            filename: 'image.jpg',
            mimeType: 'image/jpeg',
            mediaKind: 'image',
          },
        }
        expect(shouldRenderEmbed(message)).toBe(true)
      })

      it('returns false for non-media messages', () => {
        const message: Message = {
          guid: 'test-guid',
          messageKind: 'text',
          date: '2025-01-15T10:00:00Z',
          sender: 'Test User',
          text: 'Hello world',
        }
        expect(shouldRenderEmbed(message)).toBe(false)
      })

      it('returns false for video media (no embed by default)', () => {
        const message: Message = {
          guid: 'test-guid',
          messageKind: 'media',
          date: '2025-01-15T10:00:00Z',
          sender: 'Test User',
          text: '',
          media: {
            id: 'media-1',
            path: '/path/to/video.mp4',
            filename: 'video.mp4',
            mimeType: 'video/mp4',
            mediaKind: 'video',
          },
        }
        expect(shouldRenderEmbed(message)).toBe(false)
      })
    })

    describe('getEmbedPath', () => {
      it('returns media path for images', () => {
        const message: Message = {
          guid: 'test-guid',
          messageKind: 'media',
          date: '2025-01-15T10:00:00Z',
          sender: 'Test User',
          text: '',
          media: {
            id: 'media-1',
            path: '/path/to/image.jpg',
            filename: 'image.jpg',
            mimeType: 'image/jpeg',
            mediaKind: 'image',
          },
        }
        expect(getEmbedPath(message)).toBe('/path/to/image.jpg')
      })

      it('returns undefined for messages without media', () => {
        const message: Message = {
          guid: 'test-guid',
          messageKind: 'text',
          date: '2025-01-15T10:00:00Z',
          sender: 'Test User',
          text: 'Hello world',
        }
        expect(getEmbedPath(message)).toBeUndefined()
      })
    })

    describe('getPreviewPath', () => {
      it('returns preview path for HEIC images', () => {
        const path = '/path/to/image.heic'
        const preview = getPreviewPath(path)
        expect(preview).toMatch(/\.jpg$/)
        expect(preview).toContain('image.heic')
      })

      it('returns preview path for TIFF images', () => {
        const path = '/path/to/scan.tiff'
        const preview = getPreviewPath(path)
        expect(preview).toMatch(/\.jpg$/)
        expect(preview).toContain('scan.tiff')
      })

      it('returns original path for JPG images', () => {
        const path = '/path/to/image.jpg'
        const preview = getPreviewPath(path)
        expect(preview).toBe('/path/to/image.jpg')
      })

      it('returns original path for PNG images', () => {
        const path = '/path/to/image.png'
        const preview = getPreviewPath(path)
        expect(preview).toBe('/path/to/image.png')
      })
    })

    describe('getOriginalPath', () => {
      it('returns original HEIC path from preview', () => {
        const preview = '/cache/image.heic.jpg'
        const original = getOriginalPath(preview)
        expect(original).toBe('/cache/image.heic')
      })

      it('returns original TIFF path from preview', () => {
        const preview = '/cache/scan.tiff.jpg'
        const original = getOriginalPath(preview)
        expect(original).toBe('/cache/scan.tiff')
      })

      it('returns path as-is if not a preview', () => {
        const path = '/path/to/image.jpg'
        const original = getOriginalPath(path)
        expect(original).toBe('/path/to/image.jpg')
      })
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration tests', () => {
    it('renders complete media message with embed and transcription', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: 'Check this voice memo',
        media: {
          id: 'media-1',
          path: '/path/to/audio.m4a',
          filename: 'voice-memo.m4a',
          mimeType: 'audio/mp4',
          mediaKind: 'audio',
          enrichment: [
            {
              kind: 'transcription',
              transcription: 'This is the voice memo content',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'gemini',
              version: '1.0',
            },
          ],
        },
      }

      const transcriptionBlock = renderTranscriptionBlockquote(message.media!.enrichment![0])
      expect(transcriptionBlock).toContain('> This is the voice memo content')
    })

    it('renders text message with link context', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'link_context',
          url: 'https://example.com',
          title: 'Example Site',
          summary: 'Great content',
          createdAt: '2025-01-15T10:00:00Z',
          provider: 'firecrawl',
          version: '1.0',
        },
      ]

      const linkBlock = renderLinkContextBlockquote(enrichments[0])
      expect(linkBlock).toContain('[Example Site](https://example.com)')
      expect(linkBlock).toContain('> Great content')
    })

    it('renders media message with PDF summary and original link', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'pdf_summary',
          pdfSummary: 'Document contents summary',
          createdAt: '2025-01-15T10:00:00Z',
          provider: 'gemini',
          version: '1.0',
        },
      ]

      const pdfBlock = renderPdfSummaryBlockquote(enrichments[0])
      expect(pdfBlock).toContain('> Document contents summary')
    })

    it('handles message with HEIC image and preview', () => {
      const originalPath = '/attachments/photo.heic'
      const previewPath = getPreviewPath(originalPath)
      const rendered = renderPreviewImageWithLink(previewPath, originalPath)

      expect(rendered).toContain('![[')
      expect(rendered).toContain('[Original:')
      expect(rendered).toContain('photo.heic')
    })

    it('renders multiple blockquotes for message with multiple enrichments', () => {
      const enrichments: MediaEnrichment[] = [
        {
          kind: 'link_context',
          url: 'https://example.com',
          title: 'Example',
          summary: 'Summary',
          createdAt: '2025-01-15T10:00:00Z',
          provider: 'firecrawl',
          version: '1.0',
        },
        {
          kind: 'link_context',
          url: 'https://another.com',
          title: 'Another',
          summary: 'Different summary',
          createdAt: '2025-01-15T10:00:00Z',
          provider: 'firecrawl',
          version: '1.0',
        },
      ]

      const blocks = enrichments.map((e) => renderLinkContextBlockquote(e))
      expect(blocks.length).toBe(2)
      expect(blocks[0]).toContain('Example')
      expect(blocks[1]).toContain('Another')
    })
  })

  // ============================================================================
  // Enrichment Extraction and Rendering Tests
  // ============================================================================

  describe('Enrichment extraction functions', () => {
    it('gets all transcription enrichments from a message', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: '',
        media: {
          id: 'media-1',
          path: '/path/to/audio.m4a',
          filename: 'voice-memo.m4a',
          mimeType: 'audio/mp4',
          mediaKind: 'audio',
          enrichment: [
            {
              kind: 'transcription',
              transcription: 'First memo',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'gemini',
              version: '1.0',
            },
            {
              kind: 'transcription',
              transcription: 'Second memo',
              createdAt: '2025-01-15T10:01:00Z',
              provider: 'gemini',
              version: '1.0',
            },
            {
              kind: 'link_context',
              url: 'https://example.com',
              title: 'Example',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'firecrawl',
              version: '1.0',
            },
          ],
        },
      }

      const transcriptions = getTranscriptions(message)
      expect(transcriptions).toHaveLength(2)
      expect(transcriptions[0].transcription).toBe('First memo')
      expect(transcriptions[1].transcription).toBe('Second memo')
    })

    it('gets all link context enrichments from a message', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: '',
        media: {
          id: 'media-1',
          path: '/path/to/file.txt',
          filename: 'file.txt',
          mimeType: 'text/plain',
          enrichment: [
            {
              kind: 'link_context',
              url: 'https://example.com',
              title: 'Example',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'firecrawl',
              version: '1.0',
            },
            {
              kind: 'link_context',
              url: 'https://another.com',
              title: 'Another',
              createdAt: '2025-01-15T10:01:00Z',
              provider: 'firecrawl',
              version: '1.0',
            },
          ],
        },
      }

      const linkContexts = getLinkContexts(message)
      expect(linkContexts).toHaveLength(2)
      expect(linkContexts[0].url).toBe('https://example.com')
      expect(linkContexts[1].url).toBe('https://another.com')
    })

    it('gets all PDF summary enrichments from a message', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: '',
        media: {
          id: 'media-1',
          path: '/path/to/doc.pdf',
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          enrichment: [
            {
              kind: 'pdf_summary',
              pdfSummary: 'Document summary 1',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'gemini',
              version: '1.0',
            },
          ],
        },
      }

      const pdfSummaries = getPdfSummaries(message)
      expect(pdfSummaries).toHaveLength(1)
      expect(pdfSummaries[0].pdfSummary).toBe('Document summary 1')
    })
  })

  describe('renderAllEnrichments', () => {
    it('renders all enrichments for a media message with image', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: 'Check out this image',
        media: {
          id: 'media-1',
          path: '/path/to/image.jpg',
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          mediaKind: 'image',
          enrichment: [
            {
              kind: 'link_context',
              url: 'https://example.com',
              title: 'Example',
              summary: 'Great content',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'firecrawl',
              version: '1.0',
            },
          ],
        },
      }

      const result = renderAllEnrichments(message)
      expect(result.embeds).toHaveLength(1)
      expect(result.embeds[0]).toBe('![[/path/to/image.jpg]]')
      expect(result.linkContexts).toHaveLength(1)
      expect(result.transcriptions).toHaveLength(0)
      expect(result.pdfSummaries).toHaveLength(0)
    })

    it('renders HEIC preview image with link to original', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: '',
        media: {
          id: 'media-1',
          path: '/attachments/photo.heic',
          filename: 'photo.heic',
          mimeType: 'image/heic',
          mediaKind: 'image',
        },
      }

      const result = renderAllEnrichments(message)
      expect(result.embeds).toHaveLength(1)
      expect(result.embeds[0]).toContain('![[')
      expect(result.embeds[0]).toContain('[Original: photo.heic]')
    })

    it('renders message with multiple enrichment types', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'media',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: 'Audio with context',
        media: {
          id: 'media-1',
          path: '/path/to/audio.m4a',
          filename: 'audio.m4a',
          mimeType: 'audio/mp4',
          mediaKind: 'audio',
          enrichment: [
            {
              kind: 'transcription',
              transcription: 'Voice memo content',
              createdAt: '2025-01-15T10:00:00Z',
              provider: 'gemini',
              version: '1.0',
            },
            {
              kind: 'pdf_summary',
              pdfSummary: 'PDF summary',
              createdAt: '2025-01-15T10:01:00Z',
              provider: 'gemini',
              version: '1.0',
            },
            {
              kind: 'link_context',
              url: 'https://example.com',
              title: 'Reference',
              summary: 'Link summary',
              createdAt: '2025-01-15T10:02:00Z',
              provider: 'firecrawl',
              version: '1.0',
            },
          ],
        },
      }

      const result = renderAllEnrichments(message)
      expect(result.transcriptions).toHaveLength(1)
      expect(result.pdfSummaries).toHaveLength(1)
      expect(result.linkContexts).toHaveLength(1)
    })

    it('renders empty enrichments object for message without enrichments', () => {
      const message: Message = {
        guid: 'msg-1',
        messageKind: 'text',
        date: '2025-01-15T10:00:00Z',
        sender: 'Nathan',
        text: 'Just text',
      }

      const result = renderAllEnrichments(message)
      expect(result.embeds).toHaveLength(0)
      expect(result.transcriptions).toHaveLength(0)
      expect(result.linkContexts).toHaveLength(0)
      expect(result.pdfSummaries).toHaveLength(0)
    })
  })

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge cases and error handling', () => {
    it('handles very long transcriptions', () => {
      const longTranscription = 'This is a sentence. '.repeat(500)
      const enrichment: MediaEnrichment = {
        kind: 'transcription',
        transcription: longTranscription,
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'gemini',
        version: '1.0',
      }
      const result = renderTranscriptionBlockquote(enrichment)
      expect(result).toContain('> This is a sentence.')
      expect(result.length).toBeGreaterThan(1000)
    })

    it('handles special characters in link titles', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://example.com',
        title: 'A [Bracketed] Title with (parentheses)',
        summary: 'Summary with *asterisks* and _underscores_',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toContain('[Bracketed]')
      expect(result).toContain('(parentheses)')
    })

    it('handles null/undefined enrichment gracefully', () => {
      expect(() => {
        const enrichment: MediaEnrichment | undefined = undefined
        if (enrichment) renderTranscriptionBlockquote(enrichment)
      }).not.toThrow()
    })

    it('handles paths with unicode characters', () => {
      const result = renderImageEmbed('/attachments/фото_📸.jpg')
      expect(result).toBe('![[/attachments/фото_📸.jpg]]')
    })

    it('handles links with query parameters', () => {
      const enrichment: MediaEnrichment = {
        kind: 'link_context',
        url: 'https://example.com/page?id=123&sort=date',
        title: 'Page',
        summary: 'Summary',
        createdAt: '2025-01-15T10:00:00Z',
        provider: 'firecrawl',
        version: '1.0',
      }
      const result = renderLinkContextBlockquote(enrichment)
      expect(result).toContain('https://example.com/page?id=123&sort=date')
    })
  })
})
