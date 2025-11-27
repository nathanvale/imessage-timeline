/**
 * Delta Detection Module (INCREMENTAL--T02)
 *
 * Identifies new messages for enrichment by comparing current normalized state
 * with previous enrichment state.
 *
 * Implements:
 * - AC01: Load previous state from .imessage-state.json
 * - AC02: Diff normalized messages against enrichedGuids
 * - AC03: Return only new GUIDs for enrichment
 * - AC04: Handle state file missing (treat as first run)
 * - AC05: Log delta summary: Found X new messages to enrich
 *
 * Architecture:
 * - DeltaResult: Complete delta detection output
 * - detectDelta: Main entry point for delta detection
 * - extractGuidsFromMessages: Convert messages to GUID set
 * - computeDelta: Core diff logic
 * - logDeltaSummary: Human-readable delta report
 */

import { detectNewMessages, loadIncrementalState } from './incremental-state'

import type { Message } from '#schema/message'
import type { IncrementalState } from './incremental-state'

import { humanInfo } from '#utils/human'
import { createLogger } from '#utils/logger'

// ============================================================================
// Types (AC01-AC05)
// ============================================================================

/**
 * Result of delta detection
 *
 * Provides:
 * - newGuids: Message GUIDs to enrich
 * - totalMessages: Total current messages
 * - previousEnrichedCount: Messages enriched in prior run
 * - newCount: Number of new messages found
 * - isFirstRun: Whether state file was missing
 * - state: Loaded or created state for update after enrichment
 */
export type DeltaResult = {
	/** GUIDs of messages to enrich (new since last run) */
	newGuids: string[]

	/** Total messages in normalized dataset */
	totalMessages: number

	/** Count of previously enriched messages */
	previousEnrichedCount: number

	/** Number of new messages found in delta */
	newCount: number

	/** true if no prior state file found */
	isFirstRun: boolean

	/** IncrementalState to update and save after enrichment */
	state: IncrementalState
}

// ============================================================================
// AC01 + AC04: Load previous state safely
// ============================================================================

/**
 * AC01 + AC04: Load incremental state from disk
 *
 * Handles missing state file gracefully:
 * - Returns null if file doesn't exist (first run)
 * - Returns null if JSON is corrupted
 * - Returns parsed state if valid
 *
 * @param stateFilePath - Path to .imessage-state.json
 * @returns IncrementalState if found and valid, null if missing or corrupted
 */
async function loadPreviousState(
	stateFilePath: string,
): Promise<IncrementalState | null> {
	return loadIncrementalState(stateFilePath)
}

// ============================================================================
// AC02 + AC03: Extract GUIDs and compute delta
// ============================================================================

/**
 * AC02 + AC03: Extract message GUIDs from normalized messages
 *
 * Converts Message[] to Set<guid> for efficient delta computation
 *
 * @param messages - Normalized messages to process
 * @returns Set of unique message GUIDs
 */
export function extractGuidsFromMessages(messages: Message[]): Set<string> {
	const guids = new Set<string>()
	for (const msg of messages) {
		guids.add(msg.guid)
	}
	return guids
}

/**
 * AC02 + AC03: Compute delta between current and previous state
 *
 * Performance: O(n + m) where:
 * - n = number of current messages
 * - m = number of previously enriched messages
 *
 * Uses Set-based deduplication for O(1) lookup
 *
 * @param currentGuids - Set of message GUIDs from normalized state
 * @param previousState - Prior state with enriched GUIDs (null if first run)
 * @returns New GUIDs not in previous state
 */
function computeDelta(
	currentGuids: Set<string>,
	previousState: IncrementalState | null,
): string[] {
	if (!previousState) {
		// First run: all current messages are "new"
		return Array.from(currentGuids)
	}

	// Use existing delta detection from incremental-state module
	return detectNewMessages(currentGuids, previousState)
}

// ============================================================================
// AC05: Delta Summary Logging
// ============================================================================

/**
 * AC05: Log human-readable delta summary
 *
 * Outputs lines like:
 * - "Found 142 new messages to enrich"
 * - "Previously enriched: 358"
 * - "This is your first enrichment run"
 * - "Delta: 28.3% of 500 total messages"
 *
 * @param result - DeltaResult to summarize
 */
export function logDeltaSummary(result: DeltaResult): void {
	const logger = createLogger('utils:delta-detection')
	const newCount = result.newCount
	const totalCount = result.totalMessages
	const previousCount = result.previousEnrichedCount

	// Log delta summary (AC05)
	if (result.isFirstRun) {
		// Structured log (machine consumption)
		logger.info('First enrichment run', { totalMessages: totalCount })
		// Human-friendly console output retained for tests & CLI UX
		// Format expected by tests: contains both 'First enrichment run' and '<N> messages'
		humanInfo(`First enrichment run: ${totalCount} messages`)
	} else {
		const percentNew = totalCount > 0 ? (newCount / totalCount) * 100 : 0
		// Structured log
		logger.info('Delta detected', {
			newMessages: newCount,
			percentNew,
			totalMessages: totalCount,
			previouslyEnriched: previousCount,
		})
		// Human-readable lines expected by tests
		// Includes phrases: 'Delta detected', '<X> new messages', '<Y.Y%>' and 'Previously enriched: <N>'
		humanInfo(
			`Delta detected: ${newCount} new messages (${percentNew.toFixed(1)}%) of ${totalCount} total messages`,
		)
		humanInfo(`Previously enriched: ${previousCount}`)
	}
}

// ============================================================================
// AC01-AC05: Main entry point for delta detection
// ============================================================================

/**
 * AC01-AC05: Perform complete delta detection
 *
 * Workflow:
 * 1. AC04: Load previous state (null if missing)
 * 2. AC02: Extract current message GUIDs
 * 3. AC03: Compute delta (new GUIDs only)
 * 4. AC05: Log summary
 *
 * Returns DeltaResult with:
 * - newGuids to enrich
 * - metadata for progress tracking
 * - state to update after enrichment
 *
 * @param messages - Normalized messages from normalize-link stage
 * @param stateFilePath - Path to .imessage-state.json
 * @returns DeltaResult with new GUIDs and metadata
 * @throws Error if state file can't be read (permission denied, etc.)
 */
export async function detectDelta(
	messages: Message[],
	stateFilePath: string,
): Promise<DeltaResult> {
	// AC01 + AC04: Load previous state (null if missing)
	const previousState = await loadPreviousState(stateFilePath)
	const isFirstRun = previousState === null

	// AC02 + AC03: Extract current GUIDs and compute delta
	const currentGuids = extractGuidsFromMessages(messages)
	const newGuids = computeDelta(currentGuids, previousState)

	// Build result
	const result: DeltaResult = {
		newGuids,
		totalMessages: messages.length,
		previousEnrichedCount: previousState?.enrichedGuids.length ?? 0,
		newCount: newGuids.length,
		isFirstRun,
		state: previousState ?? {
			version: '1.0',
			lastEnrichedAt: new Date().toISOString(),
			totalMessages: messages.length,
			enrichedGuids: [],
			pipelineConfig: {
				configHash: '',
			},
			enrichmentStats: null,
		},
	}

	// AC05: Log summary
	logDeltaSummary(result)

	return result
}

// ============================================================================
// Utility: Get delta statistics for progress reporting
// ============================================================================

/**
 * Calculate delta statistics for progress monitoring
 *
 * Useful for:
 * - Progress bars (show percentage to enrich)
 * - ETA calculation
 * - Summary reports
 *
 * @param result - DeltaResult to analyze
 * @returns Statistics object with counts and percentages
 */
export function getDeltaStats(result: DeltaResult): {
	total: number
	new: number
	previous: number
	percentNew: number
	percentPrevious: number
} {
	const total = result.totalMessages
	const newCount = result.newCount
	const previousCount = result.previousEnrichedCount

	return {
		total,
		new: newCount,
		previous: previousCount,
		percentNew: total > 0 ? (newCount / total) * 100 : 0,
		percentPrevious: total > 0 ? (previousCount / total) * 100 : 0,
	}
}
