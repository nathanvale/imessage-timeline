/**
 * Incremental State Tracking Module (INCREMENTAL--T01)
 *
 * Implements resumable enrichment by tracking:
 * - AC01: State file with last run metadata
 * - AC02: Last enriched date, total messages, config hash
 * - AC03: GUID delta detection for new messages
 * - AC04: Atomic writes with temp + rename pattern
 * - AC05: --incremental flag integration
 *
 * Architecture:
 * - IncrementalState: Complete state schema with version, metadata, GUID tracking
 * - createIncrementalState: Factory for new state
 * - loadIncrementalState: Safe loading from disk with corruption handling
 * - saveIncrementalState: Atomic writes with temp file + rename
 * - detectNewMessages: O(n) GUID comparison using Set intersection
 * - updateStateWithEnrichedGuids: Add new enrichments and update metadata
 * - verifyConfigHash: Detect config changes between runs
 */

import crypto from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

import { humanWarn } from '#utils/human'
import { createLogger } from '#utils/logger'

// ============================================================================
// Types (AC01, AC02)
// ============================================================================

export type EnrichmentStats = {
  processedCount: number
  failedCount: number
  startTime: string
  endTime: string
}

export type PipelineConfig = {
  configHash: string
  // Future: add API keys status, CLI flags hash, etc.
}

/**
 * Complete state for incremental enrichment tracking
 * Stored in .imessage-state.json at output directory root
 */
export type IncrementalState = {
  /** Schema version for backward compatibility */
  version: string

  /** ISO 8601 UTC timestamp of last enrichment run */
  lastEnrichedAt: string

  /** Total messages as of last run (for progress reporting) */
  totalMessages: number

  /** Array of enriched message GUIDs (for delta detection) */
  enrichedGuids: string[]

  /** Pipeline configuration hash (detects config changes) */
  pipelineConfig: PipelineConfig

  /** Optional: Stats from last enrichment run */
  enrichmentStats: EnrichmentStats | null
}

// ============================================================================
// AC01 + AC02: Create and initialize state
// ============================================================================

export type CreateStateOptions = {
  totalMessages?: number
  enrichedGuids?: string[]
  enrichmentStats?: EnrichmentStats | null
}

/**
 * AC01 + AC02: Create new incremental state with current metadata
 *
 * @param options - Optional initial values
 * @returns New IncrementalState with current timestamp and config hash
 */
export function createIncrementalState(
  options: CreateStateOptions = {},
): IncrementalState {
  return {
    version: '1.0',
    lastEnrichedAt: new Date().toISOString(),
    totalMessages: options.totalMessages ?? 0,
    enrichedGuids: options.enrichedGuids ?? [],
    pipelineConfig: {
      configHash: generateConfigHash(),
    },
    enrichmentStats: options.enrichmentStats ?? null,
  }
}

/**
 * AC02: Generate hash of pipeline configuration
 * Used to detect when settings change (API keys, flags, etc.)
 *
 * @returns SHA-256 hex digest of current config
 */
function generateConfigHash(): string {
  // For now, hash empty config (future: include API key presence, CLI flags)
  const hasGeminiKey = process.env.GOOGLE_API_KEY !== undefined
  const hasFirecrawlKey = process.env.FIRECRAWL_API_KEY !== undefined

  const config = JSON.stringify({
    version: '1.0',
    // Add API key presence (not the actual key)
    hasGeminiKey,
    hasFirecrawlKey,
  })
  return crypto.createHash('sha256').update(config).digest('hex')
}

// ============================================================================
// AC03: GUID Delta Detection
// ============================================================================

/**
 * AC03: Detect new messages by comparing GUIDs with state
 *
 * Performance: O(n) where n = number of current messages
 * Using Set for fast O(1) lookup of previously enriched GUIDs
 *
 * @param currentGuids - Set of message GUIDs from normalized output
 * @param state - Previous state with enriched GUIDs
 * @returns Array of new GUID strings not in enriched set
 */
export function detectNewMessages(
  currentGuids: Set<string>,
  state: IncrementalState,
): string[] {
  const enrichedSet = new Set(state.enrichedGuids)
  const newGuids: string[] = []

  for (const guid of currentGuids) {
    if (!enrichedSet.has(guid)) {
      newGuids.push(guid)
    }
  }

  return newGuids
}

// ============================================================================
// AC04: Atomic Writes (Temp + Rename Pattern)
// ============================================================================

/**
 * AC04: Save state atomically to disk
 *
 * Pattern:
 * 1. Write to temp file with .tmp suffix
 * 2. Atomic rename (temp → final)
 * 3. Prevents corruption from power loss or crashes
 *
 * @param state - IncrementalState to persist
 * @param filePath - Target .imessage-state.json path
 * @throws Error if write fails (permission, disk full, etc.)
 */
export async function saveIncrementalState(
  state: IncrementalState,
  filePath: string,
): Promise<void> {
  const dir = path.dirname(filePath)
  const tempFile = `${filePath}.${Date.now()}.tmp`

  try {
    // Ensure parent directory exists
    await fs.mkdir(dir, { recursive: true })

    // Write to temp file
    const content = JSON.stringify(state, null, 2)
    await fs.writeFile(tempFile, content, 'utf-8')

    // Atomic rename
    await fs.rename(tempFile, filePath)
  } catch (error) {
    // Clean up temp file if rename failed
    try {
      await fs.unlink(tempFile)
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}

/**
 * AC05: Load state from disk safely
 *
 * - Returns null if file doesn't exist (treat as first run)
 * - Returns null if JSON is corrupted (ignore stale state)
 * - Validates schema version for future compatibility
 *
 * @param filePath - Path to .imessage-state.json
 * @returns IncrementalState if valid, null if missing or corrupted
 */
export async function loadIncrementalState(
  filePath: string,
): Promise<IncrementalState | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as IncrementalState

    // Validate schema version
    if (parsed.version !== '1.0') {
      const logger = createLogger('utils:incremental-state')
      logger.warn('Unknown state version. Ignoring.', {
        version: parsed.version,
      })
      return null
    }

    return parsed
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      // File doesn't exist - first run
      return null
    }
    // Corrupted JSON or other read error - ignore
    return null
  }
}

// ============================================================================
// Config Hash Verification
// ============================================================================

/**
 * AC02: Verify config hash to detect changes
 *
 * @param currentHash - Hash from current state
 * @param expectedHash - Hash to verify against (default: newly generated)
 * @returns true if hashes match
 */
export function verifyConfigHash(
  currentHash: string,
  expectedHash: string = generateConfigHash(),
): boolean {
  return currentHash === expectedHash
}

/**
 * AC02: Check if state is stale (old enrichment run)
 *
 * Useful for warning about old state that may be out of sync
 *
 * @param state - IncrementalState to check
 * @param daysThreshold - Days before state is considered stale (default: 7)
 * @returns true if state is older than threshold
 */
export function isStateOutdated(
  state: IncrementalState,
  daysThreshold: number = 7,
): boolean {
  const lastEnrichedTime = new Date(state.lastEnrichedAt).getTime()
  const now = Date.now()
  const ageMs = now - lastEnrichedTime
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays > daysThreshold) {
    const logger = createLogger('utils:incremental-state')
    logger.warn('State file is old. Consider full re-enrichment.', {
      ageDays: Math.floor(ageDays),
      daysThreshold,
    })
    // Human-visible warning for tests & interactive CLI (console.warn spied in tests)
    humanWarn(
      `State file is old (ageDays=${Math.floor(ageDays)}, threshold=${daysThreshold}). Consider full re-enrichment.`,
    )
    return true
  }

  return false
}

// ============================================================================
// Update State with Enrichment Results
// ============================================================================

/**
 * Update state with newly enriched GUIDs
 *
 * Called after successful enrichment to:
 * - Add new enriched GUIDs (avoid duplicates)
 * - Update lastEnrichedAt timestamp
 * - Record enrichment statistics
 *
 * @param state - State to update (mutated in place)
 * @param newGuids - GUIDs that were just enriched
 * @param enrichmentStats - Optional enrichment stats
 */
export function updateStateWithEnrichedGuids(
  state: IncrementalState,
  newGuids: string[],
  enrichmentStats?: EnrichmentStats,
): void {
  // Add new GUIDs, avoiding duplicates
  const existingSet = new Set(state.enrichedGuids)
  for (const guid of newGuids) {
    if (!existingSet.has(guid)) {
      state.enrichedGuids.push(guid)
    }
  }

  // Update timestamp
  state.lastEnrichedAt = new Date().toISOString()

  // Update stats if provided
  if (enrichmentStats) {
    state.enrichmentStats = enrichmentStats
  }
}

// ============================================================================
// Helper: Reset state (for testing or --force-refresh)
// ============================================================================

/**
 * Create fresh state, discarding incremental tracking
 * Used with --force-refresh flag to re-enrich everything
 *
 * @param totalMessages - Total messages to initialize with
 * @returns Fresh IncrementalState with no enriched GUIDs
 */
export function resetIncrementalState(
  totalMessages: number = 0,
): IncrementalState {
  return createIncrementalState({ totalMessages })
}
