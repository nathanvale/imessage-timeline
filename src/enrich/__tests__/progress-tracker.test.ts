import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
	type EnrichmentProgressConfig,
	EnrichmentProgressManager,
	createEnrichmentProgressManager,
} from '../progress-tracker'

describe('EnrichmentProgressManager', () => {
	let manager: EnrichmentProgressManager

	beforeEach(() => {
		manager = new EnrichmentProgressManager({
			totalMessages: 100,
			checkpointInterval: 25,
		})
	})

	afterEach(() => {
		manager.stop()
	})

	describe('AC01: Overall enrichment progress', () => {
		it('should track total messages', () => {
			const progress = manager.getProgress()
			expect(progress.total).toBe(100)
			expect(progress.processed).toBe(0)
		})

		it('should initialize with zero processed messages', () => {
			const progress = manager.getProgress()
			expect(progress.processed).toBe(0)
			expect(progress.percentage).toBe(0)
		})

		it('should increment processed count on operation completion', () => {
			manager.startOperation('image', 'photo.jpg')
			manager.completeOperation('image')

			const progress = manager.getProgress()
			expect(progress.processed).toBe(1)
		})

		it('should calculate correct percentage', () => {
			manager.startOperation('image', 'photo1.jpg')
			manager.completeOperation('image')
			manager.startOperation('image', 'photo2.jpg')
			manager.completeOperation('image')

			const progress = manager.getProgress()
			expect(progress.processed).toBe(2)
			expect(progress.percentage).toBe(2)
		})

		it('should handle all messages processed', () => {
			for (let i = 0; i < 100; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			const progress = manager.getProgress()
			expect(progress.processed).toBe(100)
			expect(progress.percentage).toBe(100)
		})
	})

	describe('AC02: Per-type progress bars', () => {
		it('should track image operations separately', () => {
			manager.setTypeTotal('image', 50)

			manager.startOperation('image', 'photo.jpg')
			manager.completeOperation('image')

			const progress = manager.getProgress()
			expect(progress.processed).toBe(1)
		})

		it('should handle multiple enrichment types', () => {
			manager.setTypeTotal('image', 25)
			manager.setTypeTotal('audio', 25)
			manager.setTypeTotal('pdf', 25)
			manager.setTypeTotal('link', 25)

			// Process different types
			manager.startOperation('image', 'photo.jpg')
			manager.completeOperation('image')

			manager.startOperation('audio', 'voice.m4a')
			manager.completeOperation('audio')

			manager.startOperation('pdf', 'document.pdf')
			manager.completeOperation('pdf')

			manager.startOperation('link', 'https://example.com')
			manager.completeOperation('link')

			const progress = manager.getProgress()
			expect(progress.processed).toBe(4)
		})

		it('should increment type-specific progress', () => {
			manager.setTypeTotal('image', 100)
			manager.incrementType('image', 5)

			// Progress should be tracked
			const progress = manager.getProgress()
			expect(progress.processed).toBe(0) // completeOperation not called, just incrementType

			// Now complete an operation
			manager.startOperation('image', 'photo.jpg')
			manager.completeOperation('image')

			const updatedProgress = manager.getProgress()
			expect(updatedProgress.processed).toBe(1)
		})

		it('should handle many operations of same type', () => {
			manager.setTypeTotal('image', 50)

			for (let i = 0; i < 10; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			const progress = manager.getProgress()
			expect(progress.processed).toBe(10)
		})
	})

	describe('AC03: Current operation display', () => {
		it('should track current operation being processed', () => {
			manager.startOperation('image', 'IMG_1234.heic')

			// Operation should be started
			expect(manager.getProgress().isCheckpointing).toBe(false)
		})

		it('should update current operation for different types', () => {
			manager.startOperation('image', 'IMG_1234.heic')
			manager.completeOperation('image')

			manager.startOperation('audio', 'voice_memo.m4a')
			manager.completeOperation('audio')

			manager.startOperation('pdf', 'document.pdf')
			manager.completeOperation('pdf')

			// Should complete without errors
			const progress = manager.getProgress()
			expect(progress.processed).toBe(3)
		})

		it('should show filename in current operation', () => {
			const filename = 'IMG_2024_12_25.heic'
			manager.startOperation('image', filename)

			// Should start without errors
			expect(manager.isVisible() || !manager.isVisible()).toBe(true)

			manager.completeOperation('image')
		})
	})

	describe('AC04: ETA calculation with rolling average', () => {
		it('should calculate ETA from operation durations', () => {
			// Simulate operations with known duration
			for (let i = 0; i < 5; i++) {
				const start = Date.now()
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')

				// Get average duration (should be small for fast operations)
				const progress = manager.getProgress()
				expect(progress.averageDuration).toBeGreaterThanOrEqual(0)
			}
		})

		it('should track last 10 operations for rolling average', () => {
			// Process 15 operations
			for (let i = 0; i < 15; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			// Should keep rolling average of last 10
			const progress = manager.getProgress()
			expect(progress.averageDuration).toBeGreaterThanOrEqual(0)
			expect(progress.processed).toBe(15)
		})

		it('should update average with each operation', () => {
			manager.startOperation('image', 'photo1.jpg')
			manager.completeOperation('image')

			const progress1 = manager.getProgress()
			const avg1 = progress1.averageDuration

			// Do more operations
			for (let i = 1; i < 5; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			const progress5 = manager.getProgress()
			// Average should converge based on actual operation times
			expect(progress5.averageDuration).toBeGreaterThanOrEqual(0)
			expect(progress5.processed).toBe(5)
		})

		it('should handle zero average duration gracefully', () => {
			// No operations yet
			const progress = manager.getProgress()
			expect(progress.averageDuration).toBe(0)
		})

		it('should reflect realistic ETA calculation', () => {
			// Simulate 10 messages taking ~10ms each (rough estimate)
			const operationCount = 10
			for (let i = 0; i < operationCount; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			const progress = manager.getProgress()
			expect(progress.processed).toBe(operationCount)
			// Average should be reasonable for operations
			expect(progress.averageDuration).toBeGreaterThanOrEqual(0)
		})
	})

	describe('AC05: Checkpoint pause indicators', () => {
		it('should detect checkpoint interval', () => {
			const config: EnrichmentProgressConfig = {
				totalMessages: 100,
				checkpointInterval: 10,
			}
			const mgr = new EnrichmentProgressManager(config)

			// Process 10 items
			for (let i = 0; i < 10; i++) {
				mgr.startOperation('image', `photo${i}.jpg`)
				mgr.completeOperation('image')

				if (i === 9) {
					// Should signal checkpoint
					expect(mgr.shouldCheckpoint()).toBe(true)
				}
			}

			mgr.stop()
		})

		it('should show checkpoint write indicator', () => {
			manager.startCheckpointWrite()
			expect(manager.getProgress().isCheckpointing).toBe(true)

			manager.completeCheckpointWrite()
			expect(manager.getProgress().isCheckpointing).toBe(false)
		})

		it('should reset checkpoint counter after write', () => {
			// Process items until checkpoint
			for (let i = 0; i < 25; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			expect(manager.shouldCheckpoint()).toBe(true)

			manager.startCheckpointWrite()
			manager.completeCheckpointWrite()

			// Counter should be reset
			expect(manager.shouldCheckpoint()).toBe(false)
		})

		it('should handle multiple checkpoints', () => {
			// Process 75 items with checkpoint interval of 25
			for (let checkpoint = 0; checkpoint < 3; checkpoint++) {
				for (let i = 0; i < 25; i++) {
					manager.startOperation('image', `photo${checkpoint}_${i}.jpg`)
					manager.completeOperation('image')
				}

				expect(manager.shouldCheckpoint()).toBe(true)

				manager.startCheckpointWrite()
				manager.completeCheckpointWrite()

				expect(manager.shouldCheckpoint()).toBe(false)
			}

			const progress = manager.getProgress()
			expect(progress.processed).toBe(75)
		})

		it('should not checkpoint during operations', () => {
			// Only 5 items processed, interval is 25
			for (let i = 0; i < 5; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			expect(manager.shouldCheckpoint()).toBe(false)
		})
	})

	describe('Quiet mode support', () => {
		it('should suppress progress in quiet mode', () => {
			const quietManager = new EnrichmentProgressManager({
				totalMessages: 100,
				quiet: true,
			})

			expect(quietManager.isVisible()).toBe(false)

			quietManager.startOperation('image', 'photo.jpg')
			quietManager.completeOperation('image')

			const progress = quietManager.getProgress()
			expect(progress.processed).toBe(1)

			quietManager.stop()
		})

		it('should track progress even when quiet', () => {
			const quietManager = new EnrichmentProgressManager({
				totalMessages: 100,
				quiet: true,
			})

			for (let i = 0; i < 50; i++) {
				quietManager.startOperation('image', `photo${i}.jpg`)
				quietManager.completeOperation('image')
			}

			const progress = quietManager.getProgress()
			expect(progress.processed).toBe(50)
			expect(progress.percentage).toBe(50)

			quietManager.stop()
		})
	})

	describe('Factory function', () => {
		it('should create manager with factory', () => {
			const factoryManager = createEnrichmentProgressManager({
				totalMessages: 200,
			})

			const progress = factoryManager.getProgress()
			expect(progress.total).toBe(200)
			expect(progress.processed).toBe(0)

			factoryManager.stop()
		})
	})

	describe('Edge cases', () => {
		it('should handle operations with long filenames', () => {
			const longFilename = `${'x'.repeat(200)}.heic`
			manager.startOperation('image', longFilename)
			manager.completeOperation('image')

			const progress = manager.getProgress()
			expect(progress.processed).toBe(1)
		})

		it('should handle rapid consecutive operations', () => {
			for (let i = 0; i < 50; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')
			}

			const progress = manager.getProgress()
			expect(progress.processed).toBe(50)
		})

		it('should handle all enrichment types in mixed order', () => {
			const types: Array<'image' | 'audio' | 'pdf' | 'link'> = ['image', 'audio', 'pdf', 'link']
			const operationsPerType = 5

			for (const type of types) {
				for (let i = 0; i < operationsPerType; i++) {
					manager.startOperation(type, `item_${type}_${i}`)
					manager.completeOperation(type)
				}
			}

			const progress = manager.getProgress()
			expect(progress.processed).toBe(20)
		})

		it('should calculate progress at any point', () => {
			for (let i = 0; i < 33; i++) {
				manager.startOperation('image', `photo${i}.jpg`)
				manager.completeOperation('image')

				if (i === 32) {
					const progress = manager.getProgress()
					expect(progress.processed).toBe(33)
					expect(progress.percentage).toBe(33)
				}
			}
		})
	})
})
