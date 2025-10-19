/**
 * Embeds and Blockquotes Rendering Module (RENDER--T03)
 *
 * Implements Obsidian-friendly embeds and blockquote rendering:
 * - AC01: Image embeds with ![[path]] syntax
 * - AC02: Preview images with links to originals (HEIC/TIFF)
 * - AC03: Transcription blockquotes with speaker labels
 * - AC04: Link context blockquotes with metadata
 * - AC05: PDF summary blockquotes with formatting
 */

import type { Message, MediaEnrichment } from '#schema/message'

/**
 * AC01: Render image embed with Obsidian wikilink syntax
 * Format: ![[path]]
 */
export function renderImageEmbed(path: string): string {
  return `![[${path}]]`
}

/**
 * AC02: Render preview image with link to original
 * For HEIC/TIFF files, shows preview with link to original
 */
export function renderPreviewImageWithLink(previewPath: string, originalPath: string): string {
  const filename = originalPath.split('/').pop() || 'original'
  return `![[${previewPath}]]\n[Original: ${filename}](${originalPath})`
}

/**
 * AC03: Render transcription as blockquote
 * Handles multiline transcriptions with speaker labels and timestamps
 */
export function renderTranscriptionBlockquote(enrichment: MediaEnrichment): string {
  if (enrichment.kind !== 'transcription' || !enrichment.transcription) {
    return ''
  }

  const lines = enrichment.transcription.split('\n')
  return lines.map((line) => `> ${line}`).join('\n')
}

/**
 * AC04: Render link context as blockquote
 * Shows title as markdown link and summary as blockquote
 */
export function renderLinkContextBlockquote(enrichment: MediaEnrichment): string {
  if (enrichment.kind !== 'link_context') {
    return ''
  }

  const parts: string[] = []

  // Format title as markdown link if available
  if (enrichment.title && enrichment.url) {
    parts.push(`> [${enrichment.title}](${enrichment.url})`)
  } else if (enrichment.url) {
    parts.push(`> [${enrichment.url}](${enrichment.url})`)
  }

  // Add summary as blockquote lines
  if (enrichment.summary) {
    const summaryLines = enrichment.summary.split('\n')
    for (const line of summaryLines) {
      if (line.trim()) {
        parts.push(`> ${line}`)
      } else {
        parts.push('> ')
      }
    }
  }

  return parts.join('\n')
}

/**
 * AC05: Render PDF summary as blockquote
 * Preserves paragraph structure with blockquote formatting
 */
export function renderPdfSummaryBlockquote(enrichment: MediaEnrichment): string {
  if (enrichment.kind !== 'pdf_summary' || !enrichment.pdfSummary) {
    return ''
  }

  const lines = enrichment.pdfSummary.split('\n')
  return lines.map((line) => `> ${line}`).join('\n')
}

/**
 * Determine if a message should render an embed
 * Only renders embeds for image media
 */
export function shouldRenderEmbed(message: Message): boolean {
  if (message.messageKind !== 'media' || !message.media) {
    return false
  }

  // Only embed images
  return message.media.mediaKind === 'image'
}

/**
 * Get the path to embed for a media message
 * Returns undefined if message cannot be embedded
 */
export function getEmbedPath(message: Message): string | undefined {
  if (!shouldRenderEmbed(message)) {
    return undefined
  }

  return message.media?.path
}

/**
 * Get preview path for an image file
 * For HEIC/TIFF, returns the .jpg preview path
 * For JPG/PNG, returns the original path
 */
export function getPreviewPath(originalPath: string): string {
  const lowerPath = originalPath.toLowerCase()

  if (lowerPath.endsWith('.heic')) {
    return `${originalPath}.jpg`
  }

  if (lowerPath.endsWith('.tiff') || lowerPath.endsWith('.tif')) {
    return `${originalPath}.jpg`
  }

  // JPG, PNG, and other formats return as-is
  return originalPath
}

/**
 * Get the original path from a preview path
 * Handles HEIC.jpg -> HEIC and TIFF.jpg -> TIFF conversions
 */
export function getOriginalPath(previewPath: string): string {
  // If it ends with .jpg, check if it's a preview
  if (previewPath.endsWith('.jpg')) {
    const withoutJpg = previewPath.slice(0, -4)

    if (withoutJpg.toLowerCase().endsWith('.heic')) {
      return withoutJpg
    }

    if (withoutJpg.toLowerCase().endsWith('.tiff') || withoutJpg.toLowerCase().endsWith('.tif')) {
      return withoutJpg
    }
  }

  return previewPath
}

/**
 * Extract enrichments of a specific kind from a media message
 */
export function getEnrichmentsByKind(
  message: Message,
  kind: MediaEnrichment['kind']
): MediaEnrichment[] {
  if (message.messageKind !== 'media' || !message.media?.enrichment) {
    return []
  }

  return message.media.enrichment.filter((e) => e.kind === kind)
}

/**
 * Get all transcription enrichments from a message
 */
export function getTranscriptions(message: Message): MediaEnrichment[] {
  return getEnrichmentsByKind(message, 'transcription')
}

/**
 * Get all link context enrichments from a message
 */
export function getLinkContexts(message: Message): MediaEnrichment[] {
  return getEnrichmentsByKind(message, 'link_context')
}

/**
 * Get all PDF summary enrichments from a message
 */
export function getPdfSummaries(message: Message): MediaEnrichment[] {
  return getEnrichmentsByKind(message, 'pdf_summary')
}

/**
 * Render all blockquotes for a message's enrichments
 */
export interface RenderedEnrichments {
  embeds: string[]
  transcriptions: string[]
  linkContexts: string[]
  pdfSummaries: string[]
}

export function renderAllEnrichments(message: Message): RenderedEnrichments {
  const result: RenderedEnrichments = {
    embeds: [],
    transcriptions: [],
    linkContexts: [],
    pdfSummaries: [],
  }

  // Handle image embeds
  if (shouldRenderEmbed(message)) {
    const embedPath = getEmbedPath(message)
    if (embedPath) {
      const previewPath = getPreviewPath(embedPath)
      if (previewPath === embedPath) {
        // No preview needed, just embed
        result.embeds.push(renderImageEmbed(embedPath))
      } else {
        // Preview available, show with link to original
        result.embeds.push(renderPreviewImageWithLink(previewPath, embedPath))
      }
    }
  }

  // Handle enrichments if media
  if (message.media?.enrichment) {
    for (const enrichment of message.media.enrichment) {
      if (enrichment.kind === 'transcription') {
        const rendered = renderTranscriptionBlockquote(enrichment)
        if (rendered) result.transcriptions.push(rendered)
      } else if (enrichment.kind === 'link_context') {
        const rendered = renderLinkContextBlockquote(enrichment)
        if (rendered) result.linkContexts.push(rendered)
      } else if (enrichment.kind === 'pdf_summary') {
        const rendered = renderPdfSummaryBlockquote(enrichment)
        if (rendered) result.pdfSummaries.push(rendered)
      }
    }
  }

  return result
}
