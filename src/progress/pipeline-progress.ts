import { ProgressManager } from './progress-manager'

/**
 * Spinner frames for indeterminate progress
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/**
 * Configuration for pipeline progress
 */
export type PipelineProgressConfig = {
	quiet?: boolean
}

/**
 * Pipeline statistics tracked across all stages
 */
export type PipelineStats = {
	totalMessages: number
	ingestedMessages: number
	normalizedMessages: number
	enrichedImages: number
	enrichedAudio: number
	enrichedPDFs: number
	enrichedLinks: number
	renderedDays: number
	startTime: number
	endTime?: number
}

/**
 * Progress tracking across ingest, normalize, and render stages
 * Provides simpler progress bars for non-enrichment stages with final summary
 */
export class PipelineProgressTracker {
	private progressManager: ProgressManager
	private quiet: boolean
	private stats: PipelineStats
	private spinnerIndex = 0
	private spinnerInterval: NodeJS.Timeout | null = null

	constructor(config: PipelineProgressConfig = {}) {
		this.quiet = config.quiet ?? false
		this.progressManager = new ProgressManager({ quiet: this.quiet })
		this.stats = {
			totalMessages: 0,
			ingestedMessages: 0,
			normalizedMessages: 0,
			enrichedImages: 0,
			enrichedAudio: 0,
			enrichedPDFs: 0,
			enrichedLinks: 0,
			renderedDays: 0,
			startTime: Date.now(),
		}
	}

	/**
	 * AC01: Ingest progress - Parsing CSV/DB rows
	 */
	public createIngestProgressBar(source: 'csv' | 'db', total: number) {
		const label = source === 'csv' ? 'Ingest CSV' : 'Ingest DB'
		return this.progressManager.createBar(label, total)
	}

	/**
	 * Update ingest progress
	 */
	public updateIngestProgress(
		source: 'csv' | 'db',
		current: number,
		_total: number,
		currentItem?: string,
	): void {
		if (this.quiet) return

		const label = source === 'csv' ? 'Ingest CSV' : 'Ingest DB'
		const description = currentItem ? `${currentItem}` : 'Processing...'

		this.progressManager.setProgress(label, current)
		this.progressManager.updateCurrent(label, description)

		// Update stats
		this.stats.ingestedMessages = Math.max(this.stats.ingestedMessages, current)
	}

	/**
	 * AC02: Normalize progress - Linking replies and deduplication
	 */
	public createNormalizeProgressBar(
		operation: 'linking' | 'dedup',
		total: number,
	) {
		const label =
			operation === 'linking' ? 'Normalize: Linking' : 'Normalize: Dedup'
		return this.progressManager.createBar(label, total)
	}

	/**
	 * Update normalize progress
	 */
	public updateNormalizeProgress(
		operation: 'linking' | 'dedup',
		current: number,
		_total: number,
		currentItem?: string,
	): void {
		if (this.quiet) return

		const label =
			operation === 'linking' ? 'Normalize: Linking' : 'Normalize: Dedup'
		const description = currentItem || 'Processing...'

		this.progressManager.setProgress(label, current)
		this.progressManager.updateCurrent(label, description)

		// Update stats
		this.stats.normalizedMessages = Math.max(
			this.stats.normalizedMessages,
			current,
		)
	}

	/**
	 * AC03: Render progress - Rendering markdown files by date
	 */
	public createRenderProgressBar(total: number) {
		return this.progressManager.createBar('Render: Markdown', total)
	}

	/**
	 * Update render progress
	 */
	public updateRenderProgress(
		current: number,
		_total: number,
		filename?: string,
	): void {
		if (this.quiet) return

		const description = filename
			? `Rendering ${filename}...`
			: 'Generating markdown...'

		this.progressManager.setProgress('Render: Markdown', current)
		this.progressManager.updateCurrent('Render: Markdown', description)

		// Update stats
		this.stats.renderedDays = Math.max(this.stats.renderedDays, current)
	}

	/**
	 * AC04: Spinner for indeterminate operations (DB queries, file I/O)
	 * Shows rotating spinner for operations with unknown duration
	 */
	public startSpinner(operation: string): void {
		if (this.quiet) return

		this.spinnerIndex = 0
		this.showSpinnerFrame(operation)

		// Update spinner every 80ms
		this.spinnerInterval = setInterval(() => {
			this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER_FRAMES.length
			this.showSpinnerFrame(operation)
		}, 80)
	}

	/**
	 * Show current spinner frame
	 */
	private showSpinnerFrame(operation: string): void {
		const frame = SPINNER_FRAMES[this.spinnerIndex]
		process.stdout.write(`\r${frame} ${operation}... `)
	}

	/**
	 * Stop spinner and clear line
	 */
	public stopSpinner(): void {
		if (this.spinnerInterval) {
			clearInterval(this.spinnerInterval)
			this.spinnerInterval = null
		}

		if (!this.quiet) {
			process.stdout.write(`\r${' '.repeat(80)}\r`)
		}
	}

	/**
	 * Update statistics
	 */
	public updateStats(stats: Partial<PipelineStats>): void {
		this.stats = { ...this.stats, ...stats }
	}

	/**
	 * AC05: Final summary - Always shown even with --quiet
	 * Displays comprehensive statistics about pipeline execution
	 */
	public showFinalSummary(): void {
		const duration = (this.stats.endTime ?? Date.now()) - this.stats.startTime
		const durationSeconds = (duration / 1000).toFixed(2)

		// Always show summary, even in quiet mode
		console.info('\n')
		console.info('═'.repeat(60))
		console.info('✓ Pipeline Execution Summary')
		console.info('═'.repeat(60))

		console.info('\n📊 Processing Statistics:')
		console.info(`  Total Messages:        ${this.stats.totalMessages}`)
		console.info(`  Ingested:              ${this.stats.ingestedMessages}`)
		console.info(`  Normalized:            ${this.stats.normalizedMessages}`)

		if (
			this.stats.enrichedImages +
				this.stats.enrichedAudio +
				this.stats.enrichedPDFs +
				this.stats.enrichedLinks >
			0
		) {
			console.info('\n🔍 Enriched Media:')
			if (this.stats.enrichedImages > 0)
				console.info(`  Images:                ${this.stats.enrichedImages}`)
			if (this.stats.enrichedAudio > 0)
				console.info(`  Audio:                 ${this.stats.enrichedAudio}`)
			if (this.stats.enrichedPDFs > 0)
				console.info(`  PDFs:                  ${this.stats.enrichedPDFs}`)
			if (this.stats.enrichedLinks > 0)
				console.info(`  Links:                 ${this.stats.enrichedLinks}`)
		}

		if (this.stats.renderedDays > 0) {
			console.info(`\n📝 Rendered:             ${this.stats.renderedDays} days`)
		}

		console.info(`\n⏱️  Duration:             ${durationSeconds}s`)
		console.info('═'.repeat(60))
		console.info('')
	}

	/**
	 * Stop all progress bars and cleanup
	 */
	public stop(): void {
		this.stopSpinner()
		this.progressManager.stopAll()
		this.stats.endTime = Date.now()
	}

	/**
	 * Get current stats
	 */
	public getStats(): Readonly<PipelineStats> {
		return Object.freeze({ ...this.stats })
	}

	/**
	 * Check if progress is visible
	 */
	public isVisible(): boolean {
		return !this.quiet && this.progressManager.isVisible()
	}
}

/**
 * Create a pipeline progress tracker instance
 */
export function createPipelineProgressTracker(
	config?: PipelineProgressConfig,
): PipelineProgressTracker {
	return new PipelineProgressTracker(config)
}

/**
 * Convenience function for running operations with a spinner
 */
export async function withSpinner<T>(
	operation: string,
	callback: () => Promise<T>,
	quiet?: boolean,
): Promise<T> {
	const tracker = new PipelineProgressTracker(
		quiet !== undefined ? { quiet } : {},
	)
	tracker.startSpinner(operation)

	try {
		const result = await callback()
		tracker.stopSpinner()
		return result
	} catch (error) {
		tracker.stopSpinner()
		throw error
	}
}
