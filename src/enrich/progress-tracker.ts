import { ProgressManager } from '../progress/progress-manager'

import type { SingleBar } from 'cli-progress'

/**
 * Types of enrichment operations tracked
 */
export type EnrichmentType = 'image' | 'audio' | 'pdf' | 'link'

/**
 * Configuration for enrichment progress tracking
 */
export type EnrichmentProgressConfig = {
	/** Disable progress bars */
	quiet?: boolean
	/** Total messages to process */
	totalMessages: number
	/** Checkpoint interval (messages between checkpoints) */
	checkpointInterval?: number
}

/**
 * Statistics for ETA calculation
 */
type OperationStats = {
	durations: number[] // Last N operation durations in ms
	maxSamples: number // Max samples to track (default: 10)
}

/**
 * Enrichment progress tracker with multi-bar support for concurrent operations
 *
 * Tracks overall progress, per-type progress, current operation, and ETA based on
 * rolling average of recent operation durations.
 */
export class EnrichmentProgressManager {
	private progressManager: ProgressManager
	private overallBar: SingleBar | null = null
	private typeBars: Map<EnrichmentType, SingleBar> = new Map()
	private currentBar: SingleBar | null = null
	private totalMessages: number
	private processedMessages = 0
	private checkpointInterval: number
	private checkpointCounter = 0
	private isCheckpointing = false
	private operationStats: OperationStats
	private lastOperationStart = 0
	private quiet: boolean

	constructor(config: EnrichmentProgressConfig) {
		this.quiet = config.quiet ?? false
		this.totalMessages = config.totalMessages
		this.checkpointInterval = config.checkpointInterval ?? 100
		this.operationStats = {
			durations: [],
			maxSamples: 10,
		}

		this.progressManager = new ProgressManager({ quiet: this.quiet })
		this.initializeBars()
	}

	/**
	 * Initialize all progress bars
	 * AC01: Overall enrichment progress (total messages)
	 * AC02: Per-type progress bars (images, audio, PDFs, links)
	 * AC03: Show current operation description
	 */
	private initializeBars(): void {
		if (this.quiet) return

		// AC01: Overall enrichment progress bar
		this.overallBar = this.progressManager.createBar(
			'Overall Enrichment',
			this.totalMessages,
		)

		// AC02: Per-type progress bars for each enrichment type
		const enrichmentTypes: EnrichmentType[] = ['image', 'audio', 'pdf', 'link']
		for (const type of enrichmentTypes) {
			const typeBar = this.progressManager.createBar(
				`${this.capitalize(type)} Analysis`,
				0,
			)
			this.typeBars.set(type, typeBar)
		}

		// AC03: Current operation bar showing what's being processed
		this.currentBar = this.progressManager.createBar('Current Operation', 1)
	}

	/**
	 * Start tracking an operation
	 * AC03: Show current operation with filename
	 */
	public startOperation(type: EnrichmentType, currentItem: string): void {
		if (this.quiet) return

		this.lastOperationStart = Date.now()

		// Update current operation bar
		if (this.currentBar) {
			this.progressManager.updateCurrent(
				'Current Operation',
				`${type}: ${currentItem}`,
			)
			this.progressManager.setProgress('Current Operation', 0)
		}
	}

	/**
	 * Complete an enrichment operation
	 * AC04: Update ETA based on rolling average of last 10 operations
	 */
	public completeOperation(type: EnrichmentType): void {
		const duration = Date.now() - this.lastOperationStart
		this.recordOperationDuration(duration)

		// Increment overall progress (always track, even in quiet mode)
		this.processedMessages++
		this.checkpointCounter++

		// Update UI only if not quiet
		if (this.quiet) return

		// Increment type-specific progress bar
		const typeBar = this.typeBars.get(type)
		if (typeBar) {
			this.progressManager.increment(`${this.capitalize(type)} Analysis`)
		}

		// Increment overall progress
		if (this.overallBar) {
			this.progressManager.setProgress(
				'Overall Enrichment',
				this.processedMessages,
			)
			this.updateETADisplay()
		}
	}

	/**
	 * Record operation duration for ETA calculation
	 * AC04: Update ETA based on rolling average of last 10 operations
	 */
	private recordOperationDuration(durationMs: number): void {
		const stats = this.operationStats
		stats.durations.push(durationMs)

		// Keep only the last N samples
		if (stats.durations.length > stats.maxSamples) {
			stats.durations.shift()
		}
	}

	/**
	 * Update ETA display based on rolling average
	 * AC04: Update ETA based on rolling average of last 10 operations
	 */
	private updateETADisplay(): void {
		if (!this.overallBar || this.operationStats.durations.length === 0) return

		const remaining = this.totalMessages - this.processedMessages
		const avgDuration = this.getAverageDuration()
		const etaMs = remaining * avgDuration

		// Update description with ETA info
		const etaSeconds = Math.ceil(etaMs / 1000)
		this.progressManager.updateCurrent(
			'Overall Enrichment',
			`${this.processedMessages}/${this.totalMessages} | ETA: ${etaSeconds}s | Avg: ${Math.round(avgDuration)}ms/msg`,
		)
	}

	/**
	 * Get average operation duration in milliseconds
	 * AC04: Calculate rolling average
	 */
	private getAverageDuration(): number {
		const durations = this.operationStats.durations
		if (durations.length === 0) return 0

		const sum = durations.reduce((a, b) => a + b, 0)
		return sum / durations.length
	}

	/**
	 * Show checkpoint pause indicator
	 * AC05: Checkpoint writes show brief pause in progress
	 */
	public startCheckpointWrite(): void {
		if (this.quiet) return
		this.isCheckpointing = true

		if (this.overallBar) {
			this.progressManager.updateCurrent(
				'Overall Enrichment',
				`💾 Writing checkpoint (${this.processedMessages}/${this.totalMessages})...`,
			)
		}
	}

	/**
	 * Resume progress after checkpoint write
	 * AC05: Resume after checkpoint pause
	 */
	public completeCheckpointWrite(): void {
		if (this.quiet) return
		this.isCheckpointing = false
		this.checkpointCounter = 0

		if (this.overallBar) {
			this.updateETADisplay()
		}
	}

	/**
	 * Check if checkpoint should be written
	 * AC05: Determine checkpoint interval
	 */
	public shouldCheckpoint(): boolean {
		return this.checkpointCounter >= this.checkpointInterval
	}

	/**
	 * Get current progress stats
	 */
	public getProgress(): {
		processed: number
		total: number
		percentage: number
		averageDuration: number
		isCheckpointing: boolean
	} {
		return {
			processed: this.processedMessages,
			total: this.totalMessages,
			percentage: Math.round(
				(this.processedMessages / this.totalMessages) * 100,
			),
			averageDuration: this.getAverageDuration(),
			isCheckpointing: this.isCheckpointing,
		}
	}

	/**
	 * Set total for a specific enrichment type
	 * AC02: Track per-type totals
	 */
	public setTypeTotal(type: EnrichmentType, total: number): void {
		if (this.quiet) return

		const barName = `${this.capitalize(type)} Analysis`
		// Create bar if it doesn't exist
		if (!this.typeBars.has(type)) {
			const typeBar = this.progressManager.createBar(barName, total)
			this.typeBars.set(type, typeBar)
		}
	}

	/**
	 * Increment type-specific progress
	 * AC02: Per-type progress bars
	 */
	public incrementType(type: EnrichmentType, count = 1): void {
		if (this.quiet) return

		const barName = `${this.capitalize(type)} Analysis`
		this.progressManager.increment(barName, count)
	}

	/**
	 * Stop all progress tracking and cleanup
	 */
	public stop(): void {
		this.progressManager.stopAll()
	}

	/**
	 * Helper to capitalize type names
	 */
	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1)
	}

	/**
	 * Check if progress bars are visible
	 */
	public isVisible(): boolean {
		return !this.quiet && this.progressManager.isVisible()
	}
}

/**
 * Create an enrichment progress manager instance
 */
export function createEnrichmentProgressManager(
	config: EnrichmentProgressConfig,
): EnrichmentProgressManager {
	return new EnrichmentProgressManager(config)
}
