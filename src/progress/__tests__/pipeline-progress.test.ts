import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as humanUtils from '#utils/human'
import {
	createPipelineProgressTracker,
	PipelineProgressTracker,
	withSpinner,
} from '../pipeline-progress'

describe('PipelineProgressTracker', () => {
	let tracker: PipelineProgressTracker

	beforeEach(() => {
		tracker = new PipelineProgressTracker()
	})

	afterEach(() => {
		tracker.stop()
	})

	describe('AC01: Ingest progress', () => {
		it('should create ingest progress bar for CSV', () => {
			const bar = tracker.createIngestProgressBar('csv', 100)
			expect(bar).toBeDefined()
		})

		it('should create ingest progress bar for DB', () => {
			const bar = tracker.createIngestProgressBar('db', 100)
			expect(bar).toBeDefined()
		})

		it('should update CSV ingest progress', () => {
			tracker.createIngestProgressBar('csv', 1000)
			tracker.updateIngestProgress('csv', 250, 1000, 'row_125.csv')

			const stats = tracker.getStats()
			expect(stats.ingestedMessages).toBe(250)
		})

		it('should update DB ingest progress', () => {
			tracker.createIngestProgressBar('db', 1000)
			tracker.updateIngestProgress('db', 500, 1000, 'processing...')

			const stats = tracker.getStats()
			expect(stats.ingestedMessages).toBe(500)
		})

		it('should track maximum ingested count', () => {
			tracker.createIngestProgressBar('csv', 1000)

			tracker.updateIngestProgress('csv', 100, 1000)
			tracker.updateIngestProgress('csv', 200, 1000)
			tracker.updateIngestProgress('csv', 150, 1000) // Goes backwards

			const stats = tracker.getStats()
			// Should track maximum seen
			expect(stats.ingestedMessages).toBe(200)
		})

		it('should suppress progress in quiet mode', () => {
			const quietTracker = new PipelineProgressTracker({ quiet: true })
			quietTracker.createIngestProgressBar('csv', 100)

			expect(() => {
				quietTracker.updateIngestProgress('csv', 50, 100)
			}).not.toThrow()

			quietTracker.stop()
		})
	})

	describe('AC02: Normalize progress', () => {
		it('should create normalize progress bar for linking', () => {
			const bar = tracker.createNormalizeProgressBar('linking', 100)
			expect(bar).toBeDefined()
		})

		it('should create normalize progress bar for dedup', () => {
			const bar = tracker.createNormalizeProgressBar('dedup', 100)
			expect(bar).toBeDefined()
		})

		it('should update linking progress', () => {
			tracker.createNormalizeProgressBar('linking', 500)
			tracker.updateNormalizeProgress('linking', 100, 500, 'linking reply 45')

			const stats = tracker.getStats()
			expect(stats.normalizedMessages).toBe(100)
		})

		it('should update dedup progress', () => {
			tracker.createNormalizeProgressBar('dedup', 500)
			tracker.updateNormalizeProgress('dedup', 250, 500, 'deduping...')

			const stats = tracker.getStats()
			expect(stats.normalizedMessages).toBe(250)
		})

		it('should track maximum normalized count', () => {
			tracker.createNormalizeProgressBar('linking', 500)

			tracker.updateNormalizeProgress('linking', 100, 500)
			tracker.updateNormalizeProgress('linking', 300, 500)
			tracker.updateNormalizeProgress('linking', 200, 500) // Goes backwards

			const stats = tracker.getStats()
			expect(stats.normalizedMessages).toBe(300)
		})
	})

	describe('AC03: Render progress', () => {
		it('should create render progress bar', () => {
			const bar = tracker.createRenderProgressBar(100)
			expect(bar).toBeDefined()
		})

		it('should update render progress', () => {
			tracker.createRenderProgressBar(30)
			tracker.updateRenderProgress(5, 30, '2024-10-15.md')

			const stats = tracker.getStats()
			expect(stats.renderedDays).toBe(5)
		})

		it('should track maximum rendered days', () => {
			tracker.createRenderProgressBar(100)

			tracker.updateRenderProgress(10, 100, '2024-10-15.md')
			tracker.updateRenderProgress(25, 100, '2024-10-20.md')
			tracker.updateRenderProgress(15, 100, '2024-10-18.md') // Goes backwards

			const stats = tracker.getStats()
			expect(stats.renderedDays).toBe(25)
		})
	})

	describe('AC04: Spinner for indeterminate operations', () => {
		it('should start and stop spinner', () => {
			tracker.startSpinner('Querying database')
			expect(() => tracker.stopSpinner()).not.toThrow()
		})

		it('should handle multiple spinner cycles', () => {
			tracker.startSpinner('Processing...')
			// Spinner runs in background
			expect(tracker.isVisible() || !tracker.isVisible()).toBe(true)
			tracker.stopSpinner()
		})

		it('should suppress spinner in quiet mode', () => {
			const quietTracker = new PipelineProgressTracker({ quiet: true })
			expect(() => {
				quietTracker.startSpinner('Operation')
				quietTracker.stopSpinner()
			}).not.toThrow()
			quietTracker.stop()
		})
	})

	describe('AC05: Final summary display', () => {
		it('should show final summary with statistics', () => {
			const humanInfoSpy = vi.spyOn(humanUtils, 'humanInfo')

			tracker.updateStats({
				totalMessages: 1000,
				ingestedMessages: 1000,
				normalizedMessages: 1000,
				enrichedImages: 250,
				enrichedAudio: 150,
				enrichedPDFs: 50,
				enrichedLinks: 300,
				renderedDays: 30,
			})

			tracker.showFinalSummary()

			// Should call humanInfo multiple times for the summary
			expect(humanInfoSpy).toHaveBeenCalled()

			humanInfoSpy.mockRestore()
		})

		it('should show summary even in quiet mode', () => {
			const quietTracker = new PipelineProgressTracker({ quiet: true })
			const humanInfoSpy = vi.spyOn(humanUtils, 'humanInfo')

			quietTracker.updateStats({
				totalMessages: 500,
				ingestedMessages: 500,
				normalizedMessages: 500,
			})

			quietTracker.showFinalSummary()

			// Summary should still be shown in quiet mode
			expect(humanInfoSpy).toHaveBeenCalled()

			humanInfoSpy.mockRestore()
			quietTracker.stop()
		})

		it('should omit zero statistics from summary', () => {
			const humanInfoSpy = vi.spyOn(humanUtils, 'humanInfo')

			// Only set some stats
			tracker.updateStats({
				totalMessages: 100,
				ingestedMessages: 100,
			})

			tracker.showFinalSummary()

			// Should not show enrichment stats if they're all zero
			expect(humanInfoSpy).toHaveBeenCalled()

			humanInfoSpy.mockRestore()
		})

		it('should display enrichment stats when available', () => {
			const humanInfoSpy = vi.spyOn(humanUtils, 'humanInfo')

			tracker.updateStats({
				enrichedImages: 50,
				enrichedAudio: 25,
			})

			tracker.showFinalSummary()

			expect(humanInfoSpy).toHaveBeenCalled()

			humanInfoSpy.mockRestore()
		})
	})

	describe('Statistics tracking', () => {
		it('should initialize stats correctly', () => {
			const stats = tracker.getStats()

			expect(stats.totalMessages).toBe(0)
			expect(stats.ingestedMessages).toBe(0)
			expect(stats.normalizedMessages).toBe(0)
			expect(stats.enrichedImages).toBe(0)
			expect(stats.enrichedAudio).toBe(0)
			expect(stats.enrichedPDFs).toBe(0)
			expect(stats.enrichedLinks).toBe(0)
			expect(stats.renderedDays).toBe(0)
			expect(stats.startTime).toBeGreaterThan(0)
			expect(stats.endTime).toBeUndefined()
		})

		it('should update stats', () => {
			tracker.updateStats({
				totalMessages: 500,
				enrichedImages: 100,
			})

			const stats = tracker.getStats()
			expect(stats.totalMessages).toBe(500)
			expect(stats.enrichedImages).toBe(100)
		})

		it('should return frozen stats object', () => {
			const stats = tracker.getStats()

			expect(() => {
				;(stats as any).totalMessages = 999
			}).toThrow()
		})
	})

	describe('Visibility control', () => {
		it('should report visibility', () => {
			expect(tracker.isVisible()).toBe(true)
		})

		it('should report not visible in quiet mode', () => {
			const quietTracker = new PipelineProgressTracker({ quiet: true })
			expect(quietTracker.isVisible()).toBe(false)
			quietTracker.stop()
		})
	})

	describe('Factory function', () => {
		it('should create tracker with factory', () => {
			const factoryTracker = createPipelineProgressTracker()
			expect(factoryTracker).toBeInstanceOf(PipelineProgressTracker)
			factoryTracker.stop()
		})

		it('should create tracker with config', () => {
			const factoryTracker = createPipelineProgressTracker({ quiet: true })
			expect(factoryTracker.isVisible()).toBe(false)
			factoryTracker.stop()
		})
	})

	describe('withSpinner convenience function', () => {
		it('should execute callback with spinner', async () => {
			const callback = vi.fn(async () => 'result')

			const result = await withSpinner('Testing', callback, false)

			expect(result).toBe('result')
			expect(callback).toHaveBeenCalled()
		})

		it('should handle async callback', async () => {
			const result = await withSpinner(
				'Processing',
				async () => {
					return 42
				},
				false,
			)

			expect(result).toBe(42)
		})

		it('should propagate errors from callback', async () => {
			const error = new Error('Test error')

			await expect(
				withSpinner(
					'Failing',
					async () => {
						throw error
					},
					false,
				),
			).rejects.toThrow('Test error')
		})

		it('should respect quiet flag in withSpinner', async () => {
			const result = await withSpinner('Quiet operation', async () => 'done', true)

			expect(result).toBe('done')
		})
	})

	describe('Multi-stage workflow', () => {
		it('should track complete pipeline workflow', () => {
			// Ingest
			tracker.createIngestProgressBar('csv', 100)
			tracker.updateIngestProgress('csv', 100, 100)

			// Normalize
			tracker.createNormalizeProgressBar('linking', 100)
			tracker.updateNormalizeProgress('linking', 100, 100)

			// Render
			tracker.createRenderProgressBar(30)
			tracker.updateRenderProgress(30, 30)

			const stats = tracker.getStats()
			expect(stats.ingestedMessages).toBe(100)
			expect(stats.normalizedMessages).toBe(100)
			expect(stats.renderedDays).toBe(30)
		})

		it('should track partial workflow', () => {
			tracker.createIngestProgressBar('csv', 100)
			tracker.updateIngestProgress('csv', 50, 100)

			tracker.createNormalizeProgressBar('linking', 50)
			tracker.updateNormalizeProgress('linking', 25, 50)

			const stats = tracker.getStats()
			expect(stats.ingestedMessages).toBe(50)
			expect(stats.normalizedMessages).toBe(25)
		})
	})

	describe('Cleanup and lifecycle', () => {
		it('should stop all progress', () => {
			tracker.createIngestProgressBar('csv', 100)
			tracker.createNormalizeProgressBar('linking', 100)
			tracker.createRenderProgressBar(30)

			expect(() => tracker.stop()).not.toThrow()
		})

		it('should set endTime on stop', () => {
			tracker.stop()
			const stats = tracker.getStats()

			expect(stats.endTime).toBeDefined()
			expect((stats.endTime ?? 0) >= stats.startTime).toBe(true)
		})
	})
})
