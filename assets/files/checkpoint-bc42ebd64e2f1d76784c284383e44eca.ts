/**
 * Checkpoint and Resume Module (ENRICH--T06)
 *
 * Implements resumable enrichment with:
 * - AC01: Checkpoint writes after N items (configurable, default 100)
 * - AC02: Full checkpoint schema with stats and failed items
 * - AC03: Atomic writes using temp file + rename pattern
 * - AC04: Resume within ≤1 item of last checkpoint
 * - AC05: Config consistency verification with hash comparison
 *
 * Architecture:
 * - createCheckpoint: Create new checkpoint with schema
 * - shouldWriteCheckpoint: Determine if checkpoint should be written
 * - getResumeIndex: Calculate resume position from checkpoint
 * - verifyConfigHash: Validate config hasn't changed
 * - getCheckpointPath: Generate deterministic checkpoint file path
 * - loadCheckpoint: Load checkpoint from disk
 * - saveCheckpoint: Write checkpoint atomically
 */

import crypto from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// ============================================================================
// Types
// ============================================================================

export type FailedItem = {
	index: number
	guid: string
	kind: string
	error: string
}

export type CheckpointStats = {
	processedCount: number
	failedCount: number
	enrichmentsByKind: Record<string, number>
}

export type EnrichCheckpoint = {
	version: string
	configHash: string
	lastProcessedIndex: number
	totalProcessed: number
	totalFailed: number
	stats: CheckpointStats
	failedItems: FailedItem[]
	createdAt: string
}

export type CheckpointInput = {
	lastProcessedIndex: number
	totalProcessed: number
	totalFailed: number
	stats: CheckpointStats
	failedItems: FailedItem[]
	configHash: string
}

// ============================================================================
// AC01: Write checkpoint after N items
// ============================================================================

/**
 * AC01: Determine if checkpoint should be written after N items
 *
 * @param itemIndex - Current item index (0-based)
 * @param checkpointInterval - Checkpoint interval (default 100)
 * @returns true if checkpoint should be written
 */
export function shouldWriteCheckpoint(
	itemIndex: number,
	checkpointInterval = 100,
): boolean {
	// Write checkpoint at multiples of interval (100, 200, 300, etc.)
	return itemIndex > 0 && itemIndex % checkpointInterval === 0
}

// ============================================================================
// AC02: Checkpoint structure with stats and failed items
// ============================================================================

/**
 * AC02: Create checkpoint with full schema
 *
 * @param input - Checkpoint input data
 * @returns EnrichCheckpoint with all required fields
 */
export function createCheckpoint(input: CheckpointInput): EnrichCheckpoint {
	return {
		version: '1.0',
		configHash: input.configHash,
		lastProcessedIndex: input.lastProcessedIndex,
		totalProcessed: input.totalProcessed,
		totalFailed: input.totalFailed,
		stats: input.stats,
		failedItems: input.failedItems,
		createdAt: new Date().toISOString(),
	}
}

// ============================================================================
// AC03: Atomic checkpoint writes
// ============================================================================

/**
 * AC03: Generate deterministic checkpoint file path
 *
 * @param checkpointDir - Directory for checkpoints
 * @param configHash - Config hash for uniqueness
 * @returns Path to checkpoint file
 */
export function getCheckpointPath(
	checkpointDir: string,
	configHash: string,
): string {
	return path.join(checkpointDir, `checkpoint-${configHash}.json`)
}

/**
 * AC03: Save checkpoint atomically using temp file + rename
 *
 * @param checkpoint - Checkpoint to save
 * @param checkpointPath - Path to save checkpoint
 */
export async function saveCheckpoint(
	checkpoint: EnrichCheckpoint,
	checkpointPath: string,
): Promise<void> {
	const tempPath = `${checkpointPath}.tmp`

	try {
		// Write to temp file
		await writeFile(tempPath, JSON.stringify(checkpoint, null, 2), 'utf-8')

		// Atomic rename (replaces original if exists)
		// In Node.js, fs.rename is atomic on most filesystems
		const fs = await import('node:fs/promises')
		await fs.rename(tempPath, checkpointPath)
	} catch (error) {
		// Clean up temp file on error
		try {
			const fs = await import('node:fs/promises')
			await fs.unlink(tempPath)
		} catch {
			// Ignore cleanup errors
		}
		throw error
	}
}

/**
 * AC03: Load checkpoint from disk
 *
 * @param checkpointPath - Path to checkpoint file
 * @returns Loaded checkpoint or null if not found
 */
export async function loadCheckpoint(
	checkpointPath: string,
): Promise<EnrichCheckpoint | null> {
	try {
		await access(checkpointPath)
		const content = await readFile(checkpointPath, 'utf-8')
		return JSON.parse(content) as EnrichCheckpoint
	} catch {
		// File doesn't exist or is invalid
		return null
	}
}

// ============================================================================
// AC04: Resume within ≤1 item
// ============================================================================

/**
 * AC04: Calculate resume index from checkpoint
 *
 * Resume at lastProcessedIndex + 1 to ensure we don't re-process
 * the last item that was in the previous checkpoint.
 *
 * @param checkpoint - Checkpoint to resume from
 * @returns Resume index (within ≤1 item of last checkpoint)
 */
export function getResumeIndex(checkpoint: EnrichCheckpoint): number {
	// Resume at next item after last processed
	return checkpoint.lastProcessedIndex + 1
}

// ============================================================================
// AC05: Config consistency verification
// ============================================================================

/**
 * AC05: Compute config hash for consistency checking
 *
 * @param config - Configuration object
 * @returns SHA-256 hash of config
 */
export function computeConfigHash(config: Record<string, unknown>): string {
	const configStr = JSON.stringify(config)
	return crypto.createHash('sha256').update(configStr).digest('hex')
}

/**
 * AC05: Verify config hasn't changed by comparing hashes
 *
 * @param checkpointHash - Hash from checkpoint
 * @param currentHash - Hash of current config
 * @returns true if hashes match (config unchanged)
 */
export function verifyConfigHash(
	checkpointHash: string,
	currentHash: string,
): boolean {
	return checkpointHash === currentHash
}

// ============================================================================
// Integration: Checkpoint State
// ============================================================================

export type CheckpointState = {
	isResuming: boolean
	lastCheckpointIndex: number
	configHash: string
	failedItemsInCheckpoint: FailedItem[]
}

/**
 * Initialize checkpoint state for enrichment run
 *
 * @param checkpoint - Loaded checkpoint or null
 * @param currentConfigHash - Hash of current config
 * @returns Checkpoint state or error
 */
export function initializeCheckpointState(
	checkpoint: EnrichCheckpoint | null,
	currentConfigHash: string,
): CheckpointState | Error {
	if (!checkpoint) {
		// No checkpoint, starting fresh
		return {
			isResuming: false,
			lastCheckpointIndex: -1,
			configHash: currentConfigHash,
			failedItemsInCheckpoint: [],
		}
	}

	// Verify config matches (AC05)
	if (!verifyConfigHash(checkpoint.configHash, currentConfigHash)) {
		return new Error(
			`Config mismatch: checkpoint was created with config ${checkpoint.configHash.substring(0, 8)}, but current config is ${currentConfigHash.substring(0, 8)}. Cannot resume with different configuration.`,
		)
	}

	// Initialize resume state
	return {
		isResuming: true,
		lastCheckpointIndex: getResumeIndex(checkpoint) - 1,
		configHash: checkpoint.configHash,
		failedItemsInCheckpoint: checkpoint.failedItems,
	}
}

/**
 * Create new checkpoint for saving after processing batch
 *
 * @param lastProcessedIndex - Index of last processed item
 * @param totalProcessed - Total items processed so far
 * @param totalFailed - Total failed items so far
 * @param batchStats - Stats for this batch
 * @param failedItems - Failed items in this batch
 * @param configHash - Hash of current config
 * @returns Checkpoint ready to save
 */
export function prepareCheckpoint(
	lastProcessedIndex: number,
	totalProcessed: number,
	totalFailed: number,
	batchStats: CheckpointStats,
	failedItems: FailedItem[],
	configHash: string,
): EnrichCheckpoint {
	return createCheckpoint({
		lastProcessedIndex,
		totalProcessed,
		totalFailed,
		stats: batchStats,
		failedItems,
		configHash,
	})
}
