/**
 * Enrichment Idempotency Module (ENRICH--T05)
 *
 * Implements idempotent enrichment operations to prevent duplicate entries:
 * - AC01: Skip enrichment if media.enrichment already contains entry with matching kind
 * - AC02: Deduplicate enrichment array by kind before adding new entries
 * - AC03: Re-running enrich-ai does not create duplicate entries (verified with tests)
 * - AC04: Support --force-refresh flag to override idempotency and re-enrich
 *
 * Key Design:
 * - Idempotency is keyed by enrichment.kind
 * - Deduplication keeps the latest enrichment by createdAt timestamp
 * - Force-refresh bypasses idempotency checks
 */

import type { Message, MediaEnrichment } from '#schema/message'

interface IdempotencyOptions {
  forceRefresh?: boolean
}

/**
 * AC01: Check if enrichment with matching kind already exists
 *
 * @param message - Message to check
 * @param kind - Enrichment kind to check for
 * @returns true if enrichment with matching kind exists, false otherwise
 */
export function shouldSkipEnrichment(message: Message, kind: MediaEnrichment['kind']): boolean {
  if (!message.media?.enrichment) {
    return false
  }

  return message.media.enrichment.some((enrichment) => enrichment.kind === kind)
}

/**
 * AC02: Deduplicate enrichment array by kind
 *
 * Removes duplicate enrichments with the same kind, keeping the most recent
 * (determined by createdAt timestamp).
 *
 * @param enrichments - Array of enrichments to deduplicate
 * @returns Deduplicated array with latest enrichment per kind
 */
export function deduplicateEnrichmentByKind(enrichments: MediaEnrichment[]): MediaEnrichment[] {
  const kindMap = new Map<MediaEnrichment['kind'], MediaEnrichment>()

  for (const enrichment of enrichments) {
    const existing = kindMap.get(enrichment.kind)

    if (!existing) {
      // First enrichment of this kind
      kindMap.set(enrichment.kind, enrichment)
    } else {
      // Compare timestamps - keep the most recent
      const existingTime = new Date(existing.createdAt).getTime()
      const newTime = new Date(enrichment.createdAt).getTime()

      if (newTime > existingTime) {
        kindMap.set(enrichment.kind, enrichment)
      }
      // If existing is more recent, keep it (no update)
    }
  }

  return Array.from(kindMap.values())
}

/**
 * AC03/AC04: Add enrichment idempotently
 *
 * Adds new enrichment to message while ensuring no duplicates are created.
 * - If forceRefresh=false (default): skips if enrichment with same kind exists
 * - If forceRefresh=true: replaces existing enrichment with same kind
 *
 * Also deduplicates the enrichment array before returning.
 *
 * @param message - Message to enrich
 * @param enrichment - New enrichment to add
 * @param options - Idempotency options (forceRefresh flag)
 * @returns Updated message with enrichment added (or original if skipped)
 */
export function addEnrichmentIdempotent(
  message: Message,
  enrichment: MediaEnrichment,
  options: IdempotencyOptions = {}
): Message {
  const { forceRefresh = false } = options

  // Early return if not a media message or media is null
  if (message.messageKind !== 'media' || !message.media) {
    return message
  }

  // Initialize enrichment array if missing
  const currentEnrichments = message.media.enrichment || []

  // Check if enrichment with same kind already exists
  const existingIndex = currentEnrichments.findIndex((e) => e.kind === enrichment.kind)

  let updatedEnrichments: MediaEnrichment[]

  if (existingIndex >= 0) {
    // Enrichment with same kind already exists
    if (forceRefresh) {
      // AC04: Replace existing enrichment (force-refresh mode)
      updatedEnrichments = [
        ...currentEnrichments.slice(0, existingIndex),
        enrichment,
        ...currentEnrichments.slice(existingIndex + 1),
      ]
    } else {
      // AC01: Skip adding (default idempotent behavior)
      updatedEnrichments = currentEnrichments
    }
  } else {
    // New enrichment kind, add it
    updatedEnrichments = [...currentEnrichments, enrichment]
  }

  // AC02: Deduplicate before returning
  const deduped = deduplicateEnrichmentByKind(updatedEnrichments)

  return {
    ...message,
    media: {
      ...message.media,
      enrichment: deduped,
    },
  }
}

/**
 * Batch add enrichments idempotently
 *
 * Applies idempotent enrichment to multiple messages.
 *
 * @param messages - Messages to enrich
 * @param enrichments - Map of message GUID to enrichment to add
 * @param options - Idempotency options
 * @returns Updated messages
 */
export function addEnrichmentsIdempotent(
  messages: Message[],
  enrichments: Map<string, MediaEnrichment>,
  options: IdempotencyOptions = {}
): Message[] {
  return messages.map((message) => {
    const enrichment = enrichments.get(message.guid)
    if (!enrichment) {
      return message
    }
    return addEnrichmentIdempotent(message, enrichment, options)
  })
}

/**
 * Check if a message has all required enrichments
 *
 * Useful for checking if enrichment stage is complete.
 *
 * @param message - Message to check
 * @param requiredKinds - Required enrichment kinds
 * @returns true if message has all required enrichment kinds
 */
export function hasAllEnrichments(
  message: Message,
  requiredKinds: MediaEnrichment['kind'][]
): boolean {
  if (!message.media?.enrichment) {
    return false
  }

  const enrichedKinds = new Set(message.media.enrichment.map((e) => e.kind))
  return requiredKinds.every((kind) => enrichedKinds.has(kind))
}

/**
 * Get enrichment by kind
 *
 * @param message - Message to search
 * @param kind - Enrichment kind to find
 * @returns Enrichment if found, undefined otherwise
 */
export function getEnrichmentByKind(
  message: Message,
  kind: MediaEnrichment['kind']
): MediaEnrichment | undefined {
  if (!message.media?.enrichment) {
    return undefined
  }

  return message.media.enrichment.find((e) => e.kind === kind)
}

/**
 * Clear enrichments of a specific kind from a message
 *
 * @param message - Message to update
 * @param kind - Enrichment kind to remove
 * @returns Updated message without enrichment of specified kind
 */
export function clearEnrichmentByKind(message: Message, kind: MediaEnrichment['kind']): Message {
  if (!message.media?.enrichment) {
    return message
  }

  const filtered = message.media.enrichment.filter((e) => e.kind !== kind)

  return {
    ...message,
    media: {
      ...message.media,
      enrichment: filtered.length > 0 ? filtered : undefined,
    },
  }
}
