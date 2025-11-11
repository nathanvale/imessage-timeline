/**
 * Enrich Module - Main Entry Point
 *
 * Provides consolidated access to all enrichment operations with idempotency
 * support built-in.
 *
 * Implements:
 * - ENRICH--T01: Image analysis with preview generation
 * - ENRICH--T02: Audio transcription
 * - ENRICH--T03: PDF/video handling
 * - ENRICH--T04: Link enrichment (pending)
 * - ENRICH--T05: Enrichment idempotency
 */

export * from './image-analysis'
export * from './audio-transcription'
export * from './pdf-video-handling'
export * from './link-enrichment'
export * from './idempotency'

import {
  shouldSkipEnrichment,
  addEnrichmentIdempotent,
  deduplicateEnrichmentByKind,
} from './idempotency'

import type { Message, MediaEnrichment } from '#schema/message'

type EnrichmentConfig = {
  enableVisionAnalysis?: boolean
  enableLinkAnalysis?: boolean
  geminiApiKey?: string
  geminiModel?: string
  imageCacheDir?: string
  firecrawlApiKey?: string
  rateLimitDelay?: number
  forceRefresh?: boolean
}

/**
 * Apply enrichment to a message with idempotency checks
 *
 * This is the main entry point for enrichment operations that ensures
 * idempotency: re-running enrichment won't create duplicate entries.
 *
 * @param message - Message to enrich
 * @param enrichment - New enrichment to add
 * @param config - Enrichment configuration including forceRefresh flag
 * @returns Updated message with enrichment applied idempotently
 */
export function applyEnrichmentIdempotent(
  message: Message,
  enrichment: MediaEnrichment,
  config: EnrichmentConfig = {},
): Message {
  const { forceRefresh = false } = config

  return addEnrichmentIdempotent(message, enrichment, { forceRefresh })
}

/**
 * Check if a message should skip enrichment of a specific kind
 *
 * @param message - Message to check
 * @param kind - Enrichment kind to check
 * @param forceRefresh - If true, always proceed (don't skip)
 * @returns true if should skip, false if should proceed
 */
export function shouldSkipEnrichmentForKind(
  message: Message,
  kind: MediaEnrichment['kind'],
  forceRefresh: boolean = false,
): boolean {
  if (forceRefresh) {
    return false
  }

  return shouldSkipEnrichment(message, kind)
}

/**
 * Ensure message enrichment is deduplicated
 *
 * Useful for cleanup after multiple enrichment operations.
 *
 * @param message - Message to deduplicate
 * @returns Message with deduplicated enrichment
 */
export function ensureDeduplicatedEnrichment(message: Message): Message {
  if (!message.media?.enrichment) {
    return message
  }

  const deduped = deduplicateEnrichmentByKind(message.media.enrichment)

  if (deduped.length === message.media.enrichment.length) {
    // No change needed
    return message
  }

  return {
    ...message,
    media: {
      ...message.media,
      enrichment: deduped,
    },
  }
}
