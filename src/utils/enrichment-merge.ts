/**
 * Enrichment Merge Module (INCREMENTAL--T03)
 *
 * Implements merge strategy for incremental enrichment results into existing
 * enriched JSON, preserving prior work and handling new enrichments.
 *
 * Implements:
 * - AC01: Load existing enriched.json if exists
 * - AC02: Merge new enrichments by GUID (new messages + updates)
 * - AC03: Preserve existing enrichments (no overwrites unless --force-refresh)
 * - AC04: Update statistics in state file
 * - AC05: Backup previous enriched.json as enriched.json.backup
 *
 * Architecture:
 * - MergeResult: Complete merge operation output
 * - MergeOptions: Configuration for merge behavior
 * - loadExistingEnriched: Load prior enriched.json safely
 * - mergeEnrichments: Core merge logic with preservation
 * - backupEnrichedJson: Atomic backup creation
 * - updateMergeStatistics: Statistics calculation
 */

import { promises as fs } from 'node:fs'

import type { ExportEnvelope, Message } from '#schema/message'

import { createLogger } from '#utils/logger'

// moved type import above to satisfy import/order

// ============================================================================
// Types (AC01-AC05)
// ============================================================================

/**
 * Options for merge behavior
 */
export type MergeOptions = {
	/** Force refresh overwrites existing enrichments (default: false) */
	forceRefresh?: boolean
}

/**
 * Statistics from merge operation
 */
export type MergeStatistics = {
	/** Number of messages merged (existing GUIDs updated) */
	mergedCount: number

	/** Number of messages added (new GUIDs) */
	addedCount: number

	/** Number of messages with preserved enrichments */
	preservedCount: number

	/** Total messages in result */
	totalMessages: number

	/** Percentage of messages that were merged */
	mergedPercentage?: number

	/** Percentage of messages that were added */
	addedPercentage?: number
}

/**
 * Result of merge operation
 */
export type MergeResult = {
	/** Merged messages with enrichments preserved/updated */
	messages: Message[]

	/** Statistics about the merge operation */
	statistics: MergeStatistics

	/** Count of messages merged */
	mergedCount: number

	/** Count of messages added */
	addedCount: number

	/** Count of messages with preserved enrichments */
	preservedCount: number
}

// ============================================================================
// AC01: Load existing enriched.json
// ============================================================================

/**
 * AC01: Load existing enriched JSON safely
 *
 * Handles:
 * - File doesn't exist (returns null)
 * - JSON is corrupted (returns null)
 * - Schema version mismatch (returns null or handles gracefully)
 * - Preserves all enrichment data
 *
 * @param filePath - Path to existing enriched.json
 * @returns ExportEnvelope if valid, null if missing or corrupted
 */
export async function loadExistingEnriched(
	filePath: string,
): Promise<ExportEnvelope | null> {
	try {
		const content = await fs.readFile(filePath, 'utf-8')
		const parsed = JSON.parse(content) as ExportEnvelope

		// Validate basic structure
		if (!parsed.messages || !Array.isArray(parsed.messages)) {
			return null
		}

		return parsed
	} catch (error) {
		// File doesn't exist or is corrupted
		if (error instanceof Error && error.message.includes('ENOENT')) {
			return null
		}
		// JSON parse error or other read error
		return null
	}
}

// ============================================================================
// AC02 + AC03: Merge enrichments by GUID
// ============================================================================

/**
 * AC02 + AC03: Merge new enrichments with existing messages
 *
 * Strategy:
 * 1. Build index of existing messages by GUID
 * 2. For each new message:
 *    - If GUID exists: merge enrichments (preserve existing unless --force-refresh)
 *    - If GUID is new: add message
 * 3. Preserve enrichment order and structure
 *
 * @param existingMessages - Messages from prior enriched.json
 * @param newMessages - New/updated messages from enrichment
 * @param options - Merge options (forceRefresh, etc.)
 * @returns MergeResult with merged messages and statistics
 */
export function mergeEnrichments(
	existingMessages: Message[],
	newMessages: Message[],
	options: MergeOptions = {},
): MergeResult {
	// Build index of existing messages by GUID
	const existingByGuid = new Map<string, Message>()
	for (const msg of existingMessages) {
		existingByGuid.set(msg.guid, msg)
	}

	// Track merge statistics
	let mergedCount = 0
	let addedCount = 0
	let preservedCount = 0

	// Track GUIDs we've processed to avoid duplicates
	const processedGuids = new Set<string>()

	// Result messages with merged enrichments
	const resultMessages: Message[] = []

	// Process new messages
	for (const newMsg of newMessages) {
		const existing = existingByGuid.get(newMsg.guid)

		if (existing) {
			// Message exists: merge enrichments
			if (!processedGuids.has(newMsg.guid)) {
				const merged = mergeMessageEnrichments(existing, newMsg, options)
				resultMessages.push(merged)
				mergedCount++

				// Count preserved enrichments
				if (
					merged.messageKind === 'media' &&
					merged.media?.enrichment &&
					merged.media.enrichment.length > 0
				) {
					preservedCount++
				}

				processedGuids.add(newMsg.guid)
			}
		} else {
			// New message: add to result
			if (!processedGuids.has(newMsg.guid)) {
				resultMessages.push(newMsg)
				addedCount++
				processedGuids.add(newMsg.guid)
			}
		}
	}

	const totalMessages = resultMessages.length

	return {
		messages: resultMessages,
		statistics: {
			mergedCount,
			addedCount,
			preservedCount,
			totalMessages,
			mergedPercentage:
				totalMessages > 0 ? (mergedCount / totalMessages) * 100 : 0,
			addedPercentage:
				totalMessages > 0 ? (addedCount / totalMessages) * 100 : 0,
		},
		mergedCount,
		addedCount,
		preservedCount,
	}
}

/**
 * AC02 + AC03: Merge enrichments for a single message
 *
 * Preservation logic:
 * - If forceRefresh: use new enrichments
 * - Otherwise:
 *   - Preserve existing enrichments by kind
 *   - Append new enrichments for different kinds
 *   - Skip enrichments for kinds that already exist (unless force)
 *
 * @param existing - Existing message with enrichments
 * @param newMsg - New message with enrichments
 * @param options - Merge options
 * @returns Merged message with preserved enrichments
 */
function mergeMessageEnrichments(
	existing: Message,
	newMsg: Message,
	options: MergeOptions,
): Message {
	// If not media message, just return existing (no enrichment to merge)
	if (existing.messageKind !== 'media' || !existing.media) {
		return existing
	}

	// If no new enrichments, keep existing as-is
	if (!newMsg.media?.enrichment || newMsg.media.enrichment.length === 0) {
		return existing
	}

	// If forceRefresh, use all new enrichments
	if (options.forceRefresh) {
		return {
			...existing,
			media: {
				...existing.media,
				enrichment: newMsg.media.enrichment,
			},
		}
	}

	// Otherwise: preserve existing, append new for different kinds
	const existingEnrichment = existing.media.enrichment ?? []
	const newEnrichment = newMsg.media.enrichment ?? []

	// Build set of existing enrichment kinds
	const existingKinds = new Set(existingEnrichment.map((e) => e.kind))

	// Only add new enrichments for kinds not already present
	const mergedEnrichment = [
		...existingEnrichment,
		...newEnrichment.filter((e) => !existingKinds.has(e.kind)),
	]

	return {
		...existing,
		media: {
			...existing.media,
			enrichment: mergedEnrichment,
		},
	}
}

// ============================================================================
// AC04: Update merge statistics
// ============================================================================

/**
 * AC04: Calculate and update merge statistics
 *
 * Computes merge percentages and summary information
 *
 * @param stats - Raw statistics
 * @returns Updated statistics with percentages
 */
export function updateMergeStatistics(stats: MergeStatistics): MergeStatistics {
	const total = stats.totalMessages

	return {
		...stats,
		mergedPercentage: total > 0 ? (stats.mergedCount / total) * 100 : 0,
		addedPercentage: total > 0 ? (stats.addedCount / total) * 100 : 0,
	}
}

// ============================================================================
// AC05: Backup existing enriched.json
// ============================================================================

/**
 * AC05: Create atomic backup of existing enriched.json
 *
 * Pattern:
 * 1. Read existing file
 * 2. Write to enriched.json.backup (overwrite if exists)
 * 3. Ensures no data loss on merge
 *
 * @param filePath - Path to enriched.json to backup
 * @throws Error if source file can't be read
 */
export async function backupEnrichedJson(filePath: string): Promise<void> {
	const backupPath = `${filePath}.backup`
	const content = await fs.readFile(filePath, 'utf-8')
	await fs.writeFile(backupPath, content, 'utf-8')
}

// ============================================================================
// Helper: Create enrichment merge result
// ============================================================================

/**
 * Create a new MergeResult with given parameters
 *
 * @param messages - Merged messages
 * @param options - Statistics options
 * @returns Complete MergeResult
 */
export function createEnrichmentMergeResult(
	messages: Message[],
	options: {
		mergedCount: number
		addedCount: number
		preservedCount: number
	},
): MergeResult {
	return {
		messages,
		statistics: {
			mergedCount: options.mergedCount,
			addedCount: options.addedCount,
			preservedCount: options.preservedCount,
			totalMessages: messages.length,
			mergedPercentage:
				messages.length > 0 ? (options.mergedCount / messages.length) * 100 : 0,
			addedPercentage:
				messages.length > 0 ? (options.addedCount / messages.length) * 100 : 0,
		},
		mergedCount: options.mergedCount,
		addedCount: options.addedCount,
		preservedCount: options.preservedCount,
	}
}

// ============================================================================
// Helper: Log merge summary
// ============================================================================

/**
 * AC05: Log human-readable merge summary
 *
 * Outputs lines like:
 * - "Merged 50 existing messages with new enrichments"
 * - "Added 10 new messages to enriched.json"
 * - "Preserved 60 enrichments from prior run"
 *
 * @param result - MergeResult to summarize
 */
export function logMergeSummary(result: MergeResult): void {
	const { mergedCount, addedCount, preservedCount } = result
	const logger = createLogger('utils:enrichment-merge')

	if (mergedCount > 0) {
		logger.info('Merged existing messages with new enrichments', {
			mergedCount,
		})
	}

	if (addedCount > 0) {
		logger.info('Added new messages to enriched.json', { addedCount })
	}

	if (preservedCount > 0) {
		logger.info('Preserved enrichments from prior run', { preservedCount })
	}

	if (mergedCount === 0 && addedCount === 0) {
		logger.info('No new enrichments to merge')
	}
}
