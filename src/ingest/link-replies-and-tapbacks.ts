import type { Message } from '#schema/message'

/**
 * Reply and tapback linking for NORMALIZE--T03
 *
 * Implements:
 * AC01: Link replies using DB association_guid as primary method
 * AC02: Apply heuristics for unlinked replies (timestamp proximity <30s, content patterns)
 * AC03: Link tapbacks to parent message GUIDs (including part GUIDs)
 * AC04: Handle ambiguous links with structured logging and tie counters
 * AC05: Maintain parity with CSV linking rules from original analyzer
 */

const REPLY_WINDOW_SECONDS = 30 // AC02: <30s proximity threshold
const REPLY_SEARCH_WINDOW_MINUTES = 5 // Expand to ±5 minutes if needed
const TAPBACK_WINDOW_SECONDS = 30 // Tapbacks within 30s of parent

type ScoredCandidate = {
  message: Message
  score: number
  reasons: string[]
}

type AmbiguousLink = {
  messageGuid: string
  selectedTarget: string
  candidates: ScoredCandidate[]
  tieCount: number
  confidenceScore: number
}

type LinkingOptions = {
  trackAmbiguous?: boolean
  minConfidenceThreshold?: number
}

type LinkingResult = {
  messages: Message[]
  ambiguousLinks?: AmbiguousLink[]
}

/**
 * AC01 + AC02: Link replies to their parent messages
 *
 * Primary: DB association_guid when present
 * Fallback: Heuristics using timestamp and content matching
 */
export function linkRepliesToParents(
  messages: Message[],
  options: LinkingOptions = {},
): Message[] | LinkingResult {
  const {
    trackAmbiguous = false,
    minConfidenceThreshold: _minConfidenceThreshold = 0.7,
  } = options

  // Build indices for fast lookup
  const byGuid = new Map<string, Message>()
  const byTimestamp = new Map<string, Message[]>()

  messages.forEach((msg) => {
    byGuid.set(msg.guid, msg)

    // Use minute-based buckets for O(1) lookup in time window searches
    const minuteBucket = new Date(msg.date).toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    if (!byTimestamp.has(minuteBucket)) {
      byTimestamp.set(minuteBucket, [])
    }
    byTimestamp.get(minuteBucket)!.push(msg)
  })

  const ambiguousLinks: AmbiguousLink[] = []
  const result = messages.map((msg) => {
    // Only process text and media replies (not already linked)
    if (msg.messageKind !== 'text' && msg.messageKind !== 'media') {
      return msg
    }

    // Skip if already has DB association
    if (msg.replyingTo?.targetMessageGuid) {
      return msg
    }

    // Skip empty replies
    if (!msg.text || msg.text.trim().length === 0) {
      return msg
    }

    // Try to link using heuristics
    const candidates = findReplyParentCandidates(
      msg,
      messages,
      byGuid,
      byTimestamp,
    )

    if (candidates.length === 0) {
      return msg
    }

    // Sort by score (descending)
    candidates.sort((a, b) => b.score - a.score)

    const topCandidate = candidates[0]
    if (!topCandidate) {
      return msg // Should never happen since we checked length > 0
    }
    const topScore = topCandidate.score

    // Check for ties
    const tiedCandidates = candidates.filter((c) => c.score === topScore)
    const isTie = tiedCandidates.length > 1

    if (isTie && trackAmbiguous) {
      const firstTied = tiedCandidates[0]
      if (firstTied) {
        ambiguousLinks.push({
          messageGuid: msg.guid,
          selectedTarget: firstTied.message.guid,
          candidates: tiedCandidates,
          tieCount: tiedCandidates.length,
          confidenceScore: topScore,
        })
      }
    }

    // Link to best candidate
    return {
      ...msg,
      replyingTo: {
        ...msg.replyingTo,
        targetMessageGuid: topCandidate.message.guid,
      },
    }
  })

  return trackAmbiguous ? { messages: result, ambiguousLinks } : result
}

/**
 * AC03: Link tapbacks to their parent messages
 *
 * Primary: DB association_guid when present
 * Fallback: Heuristics preferring media messages
 */
export function linkTapbacksToParents(
  messages: Message[],
  options: LinkingOptions = {},
): Message[] | LinkingResult {
  const { trackAmbiguous = false } = options

  // Build indices
  const byGuid = new Map<string, Message>()
  const byTimestamp = new Map<string, Message[]>()

  messages.forEach((msg) => {
    byGuid.set(msg.guid, msg)

    // Use minute-based buckets for O(1) lookup in time window searches
    const minuteBucket = new Date(msg.date).toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    if (!byTimestamp.has(minuteBucket)) {
      byTimestamp.set(minuteBucket, [])
    }
    byTimestamp.get(minuteBucket)!.push(msg)
  })

  const ambiguousLinks: AmbiguousLink[] = []
  const result = messages.map((msg) => {
    // Only process tapback messages
    if (msg.messageKind !== 'tapback') {
      return msg
    }

    // Skip if already has DB association
    if (msg.tapback?.targetMessageGuid) {
      return msg
    }

    // Find parent for this tapback
    const candidates = findTapbackParentCandidates(
      msg,
      messages,
      byGuid,
      byTimestamp,
    )

    if (candidates.length === 0) {
      return msg
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score)

    const topCandidate = candidates[0]
    if (!topCandidate) {
      return msg // Should never happen since we checked length > 0
    }
    const topScore = topCandidate.score

    // Check for ties
    const tiedCandidates = candidates.filter((c) => c.score === topScore)

    if (tiedCandidates.length > 1 && trackAmbiguous) {
      const firstTied = tiedCandidates[0]
      if (firstTied) {
        ambiguousLinks.push({
          messageGuid: msg.guid,
          selectedTarget: firstTied.message.guid,
          candidates: tiedCandidates,
          tieCount: tiedCandidates.length,
          confidenceScore: topScore,
        })
      }
    }

    // Link to best candidate
    if (!msg.tapback) {
      return msg // Shouldn't happen for tapback messages
    }

    return {
      ...msg,
      tapback: {
        ...msg.tapback,
        targetMessageGuid: topCandidate.message.guid,
      },
    }
  })

  return trackAmbiguous ? { messages: result, ambiguousLinks } : result
}

/**
 * AC04: Detect and report ambiguous links with confidence scores
 */
export function detectAmbiguousLinks(messages: Message[]) {
  const ambiguous = linkRepliesToParents(messages, {
    trackAmbiguous: true,
  }) as LinkingResult
  const tapbackAmbiguous = linkTapbacksToParents(messages, {
    trackAmbiguous: true,
  }) as LinkingResult

  const allAmbiguous = [
    ...(ambiguous.ambiguousLinks || []),
    ...(tapbackAmbiguous.ambiguousLinks || []),
  ]

  return {
    tieCount: allAmbiguous.length,
    ambiguousMessages: allAmbiguous.map((link) => ({
      messageGuid: link.messageGuid,
      selectedTarget: link.selectedTarget,
      tieCount: link.tieCount,
      topCandidates: link.candidates.map((c) => ({
        guid: c.message.guid,
        score: c.score,
        reasons: c.reasons,
      })),
    })),
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get time bucket keys for a date within a window (for O(1) lookups)
 */
function getTimeBucketKeys(date: Date, windowMinutes: number): string[] {
  const keys: string[] = []
  const baseTime = date.getTime()

  // Generate bucket keys for the window before the date
  for (let i = 0; i <= windowMinutes; i++) {
    const bucketDate = new Date(baseTime - i * 60 * 1000)
    keys.push(bucketDate.toISOString().slice(0, 16)) // YYYY-MM-DDTHH:mm (minute bucket)
  }

  return keys
}

/**
 * Find candidate parent messages for a reply
 * Returns scored candidates
 * Uses byTimestamp Map for O(1) bucket lookups instead of O(n) scan
 */
function findReplyParentCandidates(
  reply: Message,
  _allMessages: Message[],
  _byGuid: Map<string, Message>,
  byTimestamp: Map<string, Message[]>,
): ScoredCandidate[] {
  const replyDate = new Date(reply.date)
  const replyTime = replyDate.getTime()
  const candidates: ScoredCandidate[] = []
  // Use replyTime for arithmetic operations (replyDate is Date object)

  // Extract snippet from reply if present (CSV pattern: "➜ Replying to: \"<snippet>\"")
  const snippetMatch = reply.text?.match(
    /(?:➜\s*Replying to:?\s+[«"]([^»"]+)[»"]|Replying to:?\s+[«"]([^»"]+)[»"])/,
  )
  const snippet = snippetMatch?.[1] || snippetMatch?.[2]

  // Use time-bucketed lookup for O(1) average case per bucket
  const bucketKeys = getTimeBucketKeys(replyDate, REPLY_SEARCH_WINDOW_MINUTES)
  const seenGuids = new Set<string>()
  const potentialParents: Message[] = []

  for (const key of bucketKeys) {
    const bucketMessages = byTimestamp.get(key)
    if (bucketMessages) {
      for (const msg of bucketMessages) {
        if (
          !seenGuids.has(msg.guid) &&
          msg.messageKind !== 'tapback' &&
          msg.messageKind !== 'notification' &&
          msg.guid !== reply.guid
        ) {
          seenGuids.add(msg.guid)
          potentialParents.push(msg)
        }
      }
    }
  }

  // Score each candidate
  for (const candidate of potentialParents) {
    if (!candidate.text && candidate.messageKind !== 'media') {
      continue // Skip messages without text or media
    }

    const candidateTime = new Date(candidate.date).getTime()
    const timeDeltaMs = replyTime - candidateTime
    const timeDeltaSeconds = timeDeltaMs / 1000

    // Skip if too old (not within search window)
    if (
      timeDeltaSeconds < 0 ||
      timeDeltaSeconds > REPLY_SEARCH_WINDOW_MINUTES * 60
    ) {
      continue
    }

    let score = 0
    const reasons: string[] = []

    // AC02: Timestamp proximity scoring
    if (timeDeltaSeconds <= REPLY_WINDOW_SECONDS) {
      score += 20
      reasons.push(`exact_second_match (Δ${timeDeltaSeconds.toFixed(1)}s)`)
    }

    // Snippet matching (AC05: CSV parity)
    let hasContentMatch = false
    if (snippet && candidate.text) {
      const normalizedText = candidate.text.toLowerCase()
      const normalizedSnippet = snippet.toLowerCase()

      if (normalizedText.startsWith(normalizedSnippet)) {
        score += 100
        reasons.push('snippet_startswith')
        hasContentMatch = true
      } else if (normalizedText.includes(normalizedSnippet)) {
        score += 50
        reasons.push('snippet_includes')
        hasContentMatch = true
      }
    }

    // Media-implied replies (AC05: CSV parity)
    if (candidate.messageKind === 'media') {
      if (
        !snippet ||
        reply.text?.toLowerCase().includes('photo') ||
        reply.text?.toLowerCase().includes('image')
      ) {
        score += 80
        reasons.push('media_candidate')
        hasContentMatch = true
        // Prefer lower timestamp_index (earlier part)
        const indexMatch = candidate.guid.match(/p:(\d+)\//)
        if (indexMatch?.[1]) {
          score += 10 - parseInt(indexMatch[1], 10)
          reasons.push(`index_preference(${indexMatch[1]})`)
        }
      }
    }

    // Only extend beyond 30s window if there's strong content evidence
    if (timeDeltaSeconds > REPLY_WINDOW_SECONDS && hasContentMatch) {
      score -= timeDeltaSeconds / 100 // Mild penalty for distance
      reasons.push(`extended_window (Δ${timeDeltaSeconds.toFixed(1)}s)`)
    }

    // Same sender preference
    if (reply.handle && candidate.handle === reply.handle) {
      score += 15
      reasons.push('same_sender')
    }

    // Same group/moment preference
    if (reply.groupGuid && candidate.groupGuid === reply.groupGuid) {
      score += 10
      reasons.push('same_group')
    }

    if (score > 0) {
      candidates.push({ message: candidate, score, reasons })
    }
  }

  // Sort all candidates: first by score (desc), then by time proximity (asc) for tiebreaking
  candidates.sort((a, b) => {
    // Primary: score (higher is better)
    if (a.score !== b.score) {
      return b.score - a.score
    }
    // Tiebreaker: nearest prior message (lowest time delta)
    const aDelta = replyTime - new Date(a.message.date).getTime()
    const bDelta = replyTime - new Date(b.message.date).getTime()
    return aDelta - bDelta
  })

  return candidates
}

/**
 * Find candidate parent messages for a tapback
 * Prefers media messages
 * Uses byTimestamp Map for O(1) bucket lookups instead of O(n) scan
 */
function findTapbackParentCandidates(
  tapback: Message,
  _allMessages: Message[],
  _byGuid: Map<string, Message>,
  byTimestamp: Map<string, Message[]>,
): ScoredCandidate[] {
  const tapbackDate = new Date(tapback.date)
  const tapbackTime = tapbackDate.getTime()
  const candidates: ScoredCandidate[] = []

  // Use time-bucketed lookup for O(1) average case per bucket
  const bucketKeys = getTimeBucketKeys(tapbackDate, REPLY_SEARCH_WINDOW_MINUTES)
  const seenGuids = new Set<string>()
  const potentialParents: Message[] = []

  for (const key of bucketKeys) {
    const bucketMessages = byTimestamp.get(key)
    if (bucketMessages) {
      for (const msg of bucketMessages) {
        if (
          !seenGuids.has(msg.guid) &&
          msg.messageKind !== 'tapback' &&
          msg.messageKind !== 'notification' &&
          msg.guid !== tapback.guid
        ) {
          seenGuids.add(msg.guid)
          potentialParents.push(msg)
        }
      }
    }
  }

  // Score each candidate
  for (const candidate of potentialParents) {
    const candidateTime = new Date(candidate.date).getTime()
    const timeDeltaSeconds = (tapbackTime - candidateTime) / 1000

    // Skip if too old or in future
    if (
      timeDeltaSeconds < 0 ||
      timeDeltaSeconds > REPLY_SEARCH_WINDOW_MINUTES * 60
    ) {
      continue
    }

    let score = 0
    const reasons: string[] = []

    // Timestamp proximity
    if (timeDeltaSeconds <= TAPBACK_WINDOW_SECONDS) {
      score += 20
      reasons.push(`near_tap (Δ${timeDeltaSeconds.toFixed(1)}s)`)
    } else {
      score -= timeDeltaSeconds
    }

    // Media messages score higher (AC03: preferred targets)
    if (candidate.messageKind === 'media') {
      score += 80
      reasons.push('is_media')
    } else if (candidate.messageKind === 'text') {
      score += 20
      reasons.push('is_text')
    }

    // Same group preference
    if (tapback.groupGuid && candidate.groupGuid === tapback.groupGuid) {
      score += 10
      reasons.push('same_group')
    }

    if (score > 0) {
      candidates.push({ message: candidate, score, reasons })
    }
  }

  return candidates
}

export type { LinkingResult, AmbiguousLink }
