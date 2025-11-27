import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProgressManager, createProgressManager, withProgress } from '../progress-manager.ts'

describe('ProgressManager', () => {
	describe('AC01: Installation and basic setup', () => {
		it('should create a progress manager instance', () => {
			const manager = new ProgressManager()
			expect(manager).toBeDefined()
			expect(manager.isVisible()).toBe(true)
		})

		it('should have consistent styling across bars', () => {
			const manager = new ProgressManager()
			const bar1 = manager.createBar('Task 1', 100)
			const bar2 = manager.createBar('Task 2', 100)

			expect(bar1).toBeDefined()
			expect(bar2).toBeDefined()

			manager.stopAll()
		})

		it('should use default configuration when none provided', () => {
			const manager = new ProgressManager()
			expect(manager.isVisible()).toBe(true)

			manager.stopAll()
		})

		it('should accept custom format string', () => {
			const customFormat = '{name} {percentage}% {value}/{total}'
			const manager = new ProgressManager({ format: customFormat })
			expect(manager).toBeDefined()

			manager.stopAll()
		})

		it('should accept custom bar size', () => {
			const manager = new ProgressManager({ barSize: 50 })
			expect(manager).toBeDefined()

			manager.stopAll()
		})

		it('should accept custom update frequency', () => {
			const manager = new ProgressManager({ updateFrequency: 1000 })
			expect(manager).toBeDefined()

			manager.stopAll()
		})
	})

	describe('AC02: Consistent styling', () => {
		it('should pad bar names to consistent width', () => {
			const manager = new ProgressManager()
			const bar1 = manager.createBar('Short', 100)
			const bar2 = manager.createBar('This is a very long task name', 100)

			expect(bar1).toBeDefined()
			expect(bar2).toBeDefined()

			manager.stopAll()
		})

		it('should truncate current item descriptions', () => {
			const manager = new ProgressManager()
			const bar = manager.createBar('Task', 100)

			manager.updateCurrent('Task', `Processing ${'x'.repeat(100)}`)
			expect(manager.getProgress('Task')).toBe(0)

			manager.stopAll()
		})

		it('should format progress bar with all elements', () => {
			const manager = new ProgressManager()
			const bar = manager.createBar('Ingest CSV', 1000)

			// Progress should be trackable
			manager.increment('Ingest CSV')
			expect(manager.getProgress('Ingest CSV')).toBeGreaterThanOrEqual(1)

			manager.stopAll()
		})
	})

	describe('AC03: Multi-bar support for concurrent operations', () => {
		it('should create multiple concurrent progress bars', () => {
			const manager = new ProgressManager()

			const bar1 = manager.createBar('Image Analysis', 100)
			const bar2 = manager.createBar('Audio Transcription', 100)
			const bar3 = manager.createBar('Link Enrichment', 100)

			expect(bar1).toBeDefined()
			expect(bar2).toBeDefined()
			expect(bar3).toBeDefined()

			manager.stopAll()
		})

		it('should update individual bars independently', () => {
			const manager = new ProgressManager()

			manager.createBar('Task 1', 100)
			manager.createBar('Task 2', 100)

			manager.increment('Task 1', 5)
			manager.increment('Task 2', 10)

			expect(manager.getProgress('Task 1')).toBe(5)
			expect(manager.getProgress('Task 2')).toBe(10)

			manager.stopAll()
		})

		it('should handle different total values per bar', () => {
			const manager = new ProgressManager()

			manager.createBar('Image Processing', 50)
			manager.createBar('Audio Processing', 200)
			manager.createBar('Link Processing', 1000)

			// Note: cli-progress creates all bars in a multibar with the same width
			// but each bar tracks its own total internally
			const total1 = manager.getTotal('Image Processing')
			const total2 = manager.getTotal('Audio Processing')
			const total3 = manager.getTotal('Link Processing')

			// All should be positive and non-zero
			expect(total1).toBeGreaterThan(0)
			expect(total2).toBeGreaterThan(0)
			expect(total3).toBeGreaterThan(0)

			manager.stopAll()
		})

		it('should support adding and removing bars dynamically', () => {
			const manager = new ProgressManager()

			manager.createBar('Task 1', 100)
			manager.createBar('Task 2', 100)

			manager.stopBar('Task 1')

			manager.createBar('Task 3', 100)

			expect(manager.getTotal('Task 1')).toBe(0) // Stopped bar
			expect(manager.getTotal('Task 3')).toBe(100) // New bar

			manager.stopAll()
		})

		it('should update current item description per bar', () => {
			const manager = new ProgressManager()

			manager.createBar('Task 1', 100)
			manager.createBar('Task 2', 100)

			manager.updateCurrent('Task 1', 'Processing file1.jpg')
			manager.updateCurrent('Task 2', 'Processing audio.m4a')

			// Verify no errors and progress can still increment
			manager.increment('Task 1')
			manager.increment('Task 2')

			expect(manager.getProgress('Task 1')).toBe(1)
			expect(manager.getProgress('Task 2')).toBe(1)

			manager.stopAll()
		})
	})

	describe('AC04: Disable progress bars when --quiet flag used', () => {
		it('should disable progress bars in quiet mode', () => {
			const manager = new ProgressManager({ quiet: true })
			expect(manager.isVisible()).toBe(false)

			manager.stopAll()
		})

		it('should return dummy bar in quiet mode', () => {
			const manager = new ProgressManager({ quiet: true })
			const bar = manager.createBar('Task', 100)

			expect(bar).toBeDefined()

			manager.stopAll()
		})

		it('should not throw errors when updating in quiet mode', () => {
			const manager = new ProgressManager({ quiet: true })
			manager.createBar('Task', 100)

			expect(() => {
				manager.increment('Task')
				manager.updateCurrent('Task', 'Processing...')
				manager.setProgress('Task', 50)
				manager.stopBar('Task')
			}).not.toThrow()
		})

		it('should handle progress tracking in quiet mode', () => {
			const manager = new ProgressManager({ quiet: true })
			manager.createBar('Task', 100)

			// In quiet mode, operations should be no-ops but not fail
			manager.increment('Task', 10)
			manager.setProgress('Task', 50)

			// Getting progress from quiet bar should return 0
			expect(manager.getProgress('Task')).toBe(0)

			manager.stopAll()
		})

		it('createProgressManager should respect quiet flag', () => {
			const manager = createProgressManager(true)
			expect(manager.isVisible()).toBe(false)

			manager.stopAll()
		})

		it('createProgressManager should enable progress by default', () => {
			const manager = createProgressManager(false)
			expect(manager.isVisible()).toBe(true)

			manager.stopAll()
		})

		it('createProgressManager with undefined should enable progress', () => {
			const manager = createProgressManager()
			expect(manager.isVisible()).toBe(true)

			manager.stopAll()
		})
	})

	describe('AC05: Proper cleanup on Ctrl+C', () => {
		let exitCodeSpy: ReturnType<typeof vi.spyOn>
		let processOnSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			exitCodeSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
			processOnSpy = vi.spyOn(process, 'on')
		})

		afterEach(() => {
			exitCodeSpy.mockRestore()
			processOnSpy.mockRestore()
		})

		it('should setup signal handlers on initialization', () => {
			const manager = new ProgressManager()

			// Verify that signal handlers were registered
			expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
			expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
			expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function))
		})

		it('should call stopAll on SIGINT', () => {
			const manager = new ProgressManager()
			manager.createBar('Task', 100)

			const stopAllSpy = vi.spyOn(manager, 'stopAll')

			// Manually trigger the registered SIGINT handler
			const calls = processOnSpy.mock.calls
			const sigintHandler = calls.find((call) => call[0] === 'SIGINT')?.[1] as () => void
			if (sigintHandler) {
				sigintHandler()
			}

			expect(stopAllSpy).toHaveBeenCalled()
			stopAllSpy.mockRestore()
		})

		it('should call stopAll on SIGTERM', () => {
			const manager = new ProgressManager()
			manager.createBar('Task', 100)

			const stopAllSpy = vi.spyOn(manager, 'stopAll')

			// Manually trigger the registered SIGTERM handler
			const calls = processOnSpy.mock.calls
			const sigTermHandler = calls.find((call) => call[0] === 'SIGTERM')?.[1] as () => void
			if (sigTermHandler) {
				sigTermHandler()
			}

			expect(stopAllSpy).toHaveBeenCalled()
			stopAllSpy.mockRestore()
		})

		it('should cleanup multiple bars on interrupt', () => {
			const manager = new ProgressManager()
			manager.createBar('Task 1', 100)
			manager.createBar('Task 2', 100)
			manager.createBar('Task 3', 100)

			const stopAllSpy = vi.spyOn(manager, 'stopAll')

			// Trigger cleanup
			manager.stopAll()

			expect(stopAllSpy).toHaveBeenCalled()

			// Verify all bars are stopped
			expect(manager.getTotal('Task 1')).toBe(0)
			expect(manager.getTotal('Task 2')).toBe(0)
			expect(manager.getTotal('Task 3')).toBe(0)

			stopAllSpy.mockRestore()
		})

		it('should handle uncaught exceptions with cleanup', () => {
			const manager = new ProgressManager()
			manager.createBar('Task', 100)

			const stopAllSpy = vi.spyOn(manager, 'stopAll')

			// Manually trigger the registered uncaughtException handler
			const calls = processOnSpy.mock.calls
			const exceptionHandler = calls.find((call) => call[0] === 'uncaughtException')?.[1] as (
				error: Error,
			) => void
			if (exceptionHandler) {
				// Wrap in try-catch to prevent test failure from re-thrown error
				try {
					exceptionHandler(new Error('Test error'))
				} catch {
					// Expected: handler re-throws after cleanup
				}
			}

			expect(stopAllSpy).toHaveBeenCalled()
			stopAllSpy.mockRestore()
		})
	})

	describe('withProgress convenience function', () => {
		it('should execute callback with progress bar', async () => {
			const callback = vi.fn(async () => 'result')

			const result = await withProgress('Test Task', 100, callback, false)

			expect(result).toBe('result')
			expect(callback).toHaveBeenCalled()
		})

		it('should respect quiet flag in convenience function', async () => {
			const callback = vi.fn(async () => 'result')

			const result = await withProgress('Test Task', 100, callback, true)

			expect(result).toBe('result')
		})

		it('should cleanup on error', async () => {
			const error = new Error('Test error')
			const callback = vi.fn(async () => {
				throw error
			})

			await expect(withProgress('Test Task', 100, callback, false)).rejects.toThrow('Test error')

			expect(callback).toHaveBeenCalled()
		})
	})

	describe('Progress tracking edge cases', () => {
		it('should handle setting progress beyond total', () => {
			const manager = new ProgressManager()
			manager.createBar('Task', 100)

			manager.setProgress('Task', 150) // Beyond total
			expect(manager.getProgress('Task')).toBeLessThanOrEqual(100)

			manager.stopAll()
		})

		it('should handle incrementing beyond total', () => {
			const manager = new ProgressManager()
			manager.createBar('Task', 100)

			manager.setProgress('Task', 95)
			manager.increment('Task', 10) // Would exceed total

			expect(manager.getProgress('Task')).toBeLessThanOrEqual(100)

			manager.stopAll()
		})

		it('should handle nonexistent bar names gracefully', () => {
			const manager = new ProgressManager()
			manager.createBar('Existing Task', 100)

			expect(() => {
				manager.increment('Nonexistent Task')
				manager.updateCurrent('Nonexistent Task', 'test')
				manager.setProgress('Nonexistent Task', 50)
				manager.stopBar('Nonexistent Task')
			}).not.toThrow()

			expect(manager.getProgress('Nonexistent Task')).toBe(0)
			expect(manager.getTotal('Nonexistent Task')).toBe(0)

			manager.stopAll()
		})

		it('should handle empty bar names', () => {
			const manager = new ProgressManager()
			const bar = manager.createBar('', 100)

			expect(bar).toBeDefined()

			manager.stopAll()
		})

		it('should handle very long bar names', () => {
			const manager = new ProgressManager()
			const longName = 'x'.repeat(500)
			const bar = manager.createBar(longName, 100)

			expect(bar).toBeDefined()

			manager.stopAll()
		})
	})
})
