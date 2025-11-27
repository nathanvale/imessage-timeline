/**
 * Clean Command
 *
 * Remove temporary files and checkpoints.
 * CLI-T05-AC03: clean command to remove checkpoints and temp files
 */

import type { Command } from 'commander'
import { humanError, humanInfo, humanWarn } from '#utils/human'
import type { CleanOptions, GlobalOptions } from '../types.js'
import { applyLogLevel, logEvent } from '../utils.js'

/**
 * Execute the clean command logic
 */
export async function executeClean(
	options: CleanOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { checkpointDir, force, all } = options
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)

	const fs = await import('node:fs')
	const path = await import('node:path')

	// Check if checkpoint dir exists
	if (!fs.existsSync(checkpointDir)) {
		if (verbose) {
			humanInfo(`ℹ️  Checkpoint directory not found: ${checkpointDir}`)
		}
		logEvent('clean-missing-dir', {
			command: 'clean',
			phase: 'progress',
			options: { checkpointDir },
		})
		process.exit(0)
	}

	if (!fs.statSync(checkpointDir).isDirectory()) {
		humanError(`❌ Not a directory: ${checkpointDir}`)
		process.exit(1)
	}

	// List files to be removed
	const files = fs.readdirSync(checkpointDir)
	const toRemove = files.filter(
		(f) =>
			f.startsWith('enrich-checkpoint-') ||
			(all && (f.endsWith('.backup') || f.endsWith('.old'))),
	)

	if (toRemove.length === 0) {
		humanInfo('ℹ️  No checkpoint files to clean')
		logEvent('clean-none', {
			command: 'clean',
			phase: 'summary',
			metrics: { removed: 0 },
			options: { checkpointDir },
			exitCode: 0,
		})
		process.exit(0)
	}

	// Show what will be removed
	humanInfo('♻️  Files to be removed:')
	toRemove.forEach((f) => {
		const filepath = path.join(checkpointDir, f)
		const size = fs.statSync(filepath).size
		humanInfo(`    ${f} (${(size / 1024).toFixed(1)} KB)`)
	})
	logEvent('clean-list', {
		command: 'clean',
		phase: 'progress',
		metrics: { count: toRemove.length },
		options: { checkpointDir, all },
	})

	if (!force) {
		humanInfo('\nRun with --force to remove these files')
		logEvent('clean-requires-force', {
			command: 'clean',
			phase: 'progress',
			options: { checkpointDir, all },
		})
		process.exit(0)
	}

	// Remove files
	let removed = 0
	toRemove.forEach((f) => {
		const filepath = path.join(checkpointDir, f)
		try {
			fs.unlinkSync(filepath)
			removed++
			if (verbose) {
				humanInfo(`✓ Removed ${f}`)
				logEvent('clean-file-removed', {
					command: 'clean',
					phase: 'progress',
					context: { file: f },
				})
			}
		} catch {
			humanWarn(`⚠️  Failed to remove ${f}`)
			logEvent('clean-file-remove-failed', {
				command: 'clean',
				phase: 'warning',
				context: { file: f },
			})
		}
	})

	humanInfo(`✅ Cleaned ${removed} checkpoint file(s)`)
	logEvent('clean-summary', {
		command: 'clean',
		phase: 'summary',
		metrics: { removed },
		options: { checkpointDir, all },
		exitCode: 0,
	})
}

/**
 * Register the clean command with Commander
 */
export function registerCleanCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('clean')
		.description('Remove temporary files and checkpoints')
		.option(
			'-c, --checkpoint-dir <path>',
			'checkpoint directory to clean',
			'./.checkpoints',
		)
		.option('-f, --force', 'remove without confirmation', false)
		.option('--all', 'also remove backup files (.backup, .old)', false)
		.action(async (options: CleanOptions) => {
			try {
				await executeClean(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Clean failed:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('clean-error', {
					command: 'clean',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					options: { checkpointDir: options.checkpointDir, all: options.all },
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
