/**
 * Validate Command
 *
 * Validate JSON file against message schema.
 * CLI-T05-AC01: validate command to check JSON against schema
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import type { GlobalOptions, ValidateOptions } from '../types.js'
import { applyLogLevel, logEvent } from '../utils.js'

/**
 * Execute the validate command logic
 */
export async function executeValidate(
	options: ValidateOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { input, quiet } = options
	const { verbose } = globalOptions

	applyLogLevel(verbose, globalOptions.quiet)

	const fs = await import('node:fs')

	// Validate input file exists
	if (!fs.existsSync(input)) {
		humanError(`❌ Input file not found: ${input}`)
		process.exit(1)
	}

	// Load and parse JSON
	const content = fs.readFileSync(input, 'utf-8')
	let data: unknown
	try {
		data = JSON.parse(content)
	} catch (e) {
		humanError(`❌ Invalid JSON: ${input}`)
		humanError(`  ${e instanceof Error ? e.message : String(e)}`)
		process.exit(1)
	}

	// Validate schema
	const { MessageSchema } = await import('../../schema/message.js')
	const messages = Array.isArray(data)
		? data
		: (data as { messages?: unknown[] }).messages || []

	let validCount = 0
	const errors: Array<{ index: number; path: string; message: string }> = []

	for (let i = 0; i < messages.length; i++) {
		const result = MessageSchema.safeParse(messages[i] as unknown)
		if (result.success) {
			validCount++
		} else {
			result.error.errors.forEach(
				(err: { path: Array<string | number>; message: string }) => {
					errors.push({
						index: i,
						path: err.path.join('.'),
						message: err.message,
					})
				},
			)
		}
	}

	// Output results
	if (!quiet) {
		humanInfo('📊 Validation Results:')
		humanInfo(`  Valid: ${validCount}/${messages.length}`)
	}
	logEvent('validate-results', {
		command: 'validate',
		phase: 'progress',
		metrics: {
			valid: validCount,
			total: messages.length,
			errors: errors.length,
		},
		options: { quiet },
	})

	if (errors.length === 0) {
		humanInfo(`✅ All ${messages.length} messages are valid`)
		logEvent('validate-summary', {
			command: 'validate',
			phase: 'summary',
			metrics: { valid: validCount, total: messages.length },
			exitCode: 0,
		})
		process.exit(0)
	} else {
		humanError(`❌ ${errors.length} validation error(s) found`)
		logEvent('validate-error-summary', {
			command: 'validate',
			phase: 'error',
			metrics: {
				valid: validCount,
				total: messages.length,
				errors: errors.length,
			},
			exitCode: 1,
		})

		if (!quiet) {
			const grouped = new Map<
				number,
				Array<{ path: string; message: string }>
			>()
			errors.forEach((err) => {
				if (!grouped.has(err.index)) grouped.set(err.index, [])
				grouped.get(err.index)!.push({ path: err.path, message: err.message })
			})

			let shown = 0
			grouped.forEach((errs, index) => {
				if (shown < 10) {
					humanError(`\n  Message ${index}:`)
					errs.forEach((err) => {
						humanError(`    ${err.path || 'root'}: ${err.message}`)
						shown++
						if (shown >= 10) return
					})
				}
			})

			if (shown < errors.length) {
				humanError(`\n  ... and ${errors.length - shown} more errors`)
			}
		}

		process.exit(1)
	}
}

/**
 * Register the validate command with Commander
 */
export function registerValidateCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('validate')
		.description('Validate JSON file against message schema')
		.requiredOption('-i, --input <path>', 'path to JSON file to validate')
		.option('-q, --quiet', 'suppress detailed error messages', false)
		.action(async (options: ValidateOptions) => {
			try {
				await executeValidate(options, getGlobalOptions())
			} catch (error) {
				humanError(
					'❌ Validation failed:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('validate-runtime-error', {
					command: 'validate',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
