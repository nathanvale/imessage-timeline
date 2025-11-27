/**
 * Ingest CSV Command
 *
 * Import messages from iMazing CSV export.
 * CLI-T02-AC01: ingest-csv command with all options from usage guide
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import { setCorrelationId } from '#utils/logger'
import type { GlobalOptions, IngestCSVOptions } from '../types.js'
import { applyLogLevel, cliLogger, logEvent } from '../utils.js'

/**
 * Execute the ingest-csv command logic
 */
export async function executeIngestCSV(
	options: IngestCSVOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { input, output, attachments } = options
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)
	setCorrelationId(`ingest-csv:${Date.now().toString(36)}`)

	logEvent('ingest-start', {
		command: 'ingest-csv',
		phase: 'start',
		options: { input, output, attachmentsCount: attachments?.length },
	})

	// CLI-T02-AC04: Input file validation with clear error messages
	const fs = await import('node:fs')
	if (!fs.existsSync(input)) {
		humanError(`❌ Input CSV file not found: ${input}`)
		humanError('\nPlease check:')
		humanError('  • File path is correct')
		humanError('  • File exists and is readable')
		process.exit(1)
	}

	// CLI-T02-AC03: Attachment root validation (check directories exist)
	const attachmentRoots: string[] = []
	if (attachments && attachments.length > 0) {
		for (const dir of attachments) {
			if (!fs.existsSync(dir)) {
				humanError(`❌ Attachment directory not found: ${dir}`)
				process.exit(1)
			}
			if (!fs.statSync(dir).isDirectory()) {
				humanError(`❌ Not a directory: ${dir}`)
				process.exit(1)
			}
			attachmentRoots.push(dir)
		}
	} else {
		// Default: ~/Library/Messages/Attachments
		const os = await import('node:os')
		const path = await import('node:path')
		const defaultRoot = path.join(
			os.homedir(),
			'Library',
			'Messages',
			'Attachments',
		)
		if (fs.existsSync(defaultRoot)) {
			attachmentRoots.push(defaultRoot)
			if (verbose) {
				cliLogger.info('Using default attachment root', { defaultRoot })
			}
		}
	}

	// CLI-T02-AC01: ingest-csv command with all options from usage guide
	const { ingestCSV, createExportEnvelope, validateMessages } = await import(
		'../../ingest/ingest-csv.js'
	)

	if (verbose) {
		cliLogger.info('Reading CSV ingest', { input, attachmentRoots })
	}

	const messages = ingestCSV(input, { attachmentRoots })

	// CLI-T02-AC05: Progress output: ✓ Parsed 2,847 messages from CSV
	humanInfo(`✓ Parsed ${messages.length.toLocaleString()} messages from CSV`)

	// Validate messages before writing
	const validation = validateMessages(messages)
	if (!validation.valid) {
		humanError(`❌ ${validation.errors.length} messages failed validation`)
		if (verbose) {
			validation.errors.slice(0, 5).forEach((err) => {
				humanError(`  Message ${err.index}:`, err.issues)
			})
		}
		process.exit(1)
	}

	// Write export envelope
	const envelope = createExportEnvelope(messages)
	fs.writeFileSync(output, JSON.stringify(envelope, null, 2), 'utf-8')

	humanInfo(`✓ Wrote ${messages.length.toLocaleString()} messages to ${output}`)
	humanInfo('\n📊 Summary:')
	const textCount = messages.filter((m) => m.messageKind === 'text').length
	const mediaCount = messages.filter((m) => m.messageKind === 'media').length
	const notifCount = messages.filter(
		(m) => m.messageKind === 'notification',
	).length
	humanInfo(`  Text: ${textCount}`)
	humanInfo(`  Media: ${mediaCount}`)
	humanInfo(`  Notifications: ${notifCount}`)

	logEvent('ingest-summary', {
		command: 'ingest-csv',
		phase: 'summary',
		metrics: {
			total: messages.length,
			text: textCount,
			media: mediaCount,
			notifications: notifCount,
		},
		options: { output },
		exitCode: 0,
	})
}

/**
 * Register the ingest-csv command with Commander
 */
export function registerIngestCSVCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('ingest-csv')
		.description('Import messages from iMazing CSV export')
		.requiredOption('-i, --input <path>', 'path to CSV file')
		.option(
			'-o, --output <path>',
			'output JSON file path',
			'./messages.csv.ingested.json',
		)
		.option('-a, --attachments <dir...>', 'attachment root directories')
		.action(async (options: IngestCSVOptions) => {
			try {
				await executeIngestCSV(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Failed to ingest CSV:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('ingest-error', {
					command: 'ingest-csv',
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
