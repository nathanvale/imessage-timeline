/**
 * Ingest DB Command
 *
 * Import messages from macOS Messages.app database export (JSON).
 * CLI-T02-AC02: ingest-db command with database path and contact filtering
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import type { DBMessage } from '../../ingest/ingest-db.js'
import type { Message } from '../../schema/message.js'
import type { GlobalOptions, IngestDBOptions } from '../types.js'
import { applyLogLevel, cliLogger, logEvent } from '../utils.js'

/**
 * Execute the ingest-db command logic
 */
export async function executeIngestDB(
	options: IngestDBOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { input, output, attachments, contact } = options
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)

	logEvent('ingest-start', {
		command: 'ingest-db',
		phase: 'start',
		options: {
			input,
			output,
			attachmentsCount: attachments?.length,
			contact,
		},
	})

	// CLI-T02-AC04: Input file validation with clear error messages
	const fs = await import('node:fs')
	if (!fs.existsSync(input)) {
		humanError(`❌ Input JSON file not found: ${input}`)
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
				humanInfo(`Using default attachment root: ${defaultRoot}`)
			}
		}
	}

	// CLI-T02-AC02: ingest-db command with database path and contact filtering
	const { splitDBMessage } = await import('../../ingest/ingest-db.js')
	const { createExportEnvelope, validateMessages } = await import(
		'../../ingest/ingest-csv.js'
	)

	if (verbose) {
		cliLogger.info('Reading DB export', {
			input,
			attachmentRoots,
			contact,
		})
	}

	// Read and parse DB export JSON
	const content = fs.readFileSync(input, 'utf-8')
	const dbMessages = JSON.parse(content) as DBMessage[]

	if (!Array.isArray(dbMessages)) {
		humanError(
			`❌ Expected JSON array of DB messages, got: ${typeof dbMessages}`,
		)
		process.exit(1)
	}

	// Filter by contact if specified
	let filteredMessages: DBMessage[] = dbMessages
	if (contact) {
		filteredMessages = dbMessages.filter((m: DBMessage) => m.handle === contact)
		humanInfo(
			`✓ Filtered to ${filteredMessages.length} messages from ${contact}`,
		)
	}

	// Split DB messages into Message objects
	const messages: Message[] = []
	filteredMessages.forEach((dbMsg: DBMessage, index: number) => {
		const split = splitDBMessage(dbMsg, index + 1, { attachmentRoots })
		messages.push(...split)
	})

	// CLI-T02-AC05: Progress output
	humanInfo(
		`✓ Parsed ${messages.length.toLocaleString()} messages from DB export`,
	)

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
	const dbText = messages.filter(
		(m: Message) => m.messageKind === 'text',
	).length
	const dbMedia = messages.filter(
		(m: Message) => m.messageKind === 'media',
	).length
	humanInfo(`  Text: ${dbText}`)
	humanInfo(`  Media: ${dbMedia}`)

	logEvent('ingest-summary', {
		command: 'ingest-db',
		phase: 'summary',
		metrics: { total: messages.length, text: dbText, media: dbMedia },
		options: { output, contact },
		exitCode: 0,
	})
}

/**
 * Register the ingest-db command with Commander
 */
export function registerIngestDBCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('ingest-db')
		.description(
			'Import messages from macOS Messages.app database export (JSON)',
		)
		.requiredOption('-i, --input <path>', 'path to JSON file with DB messages')
		.option(
			'-o, --output <path>',
			'output JSON file path',
			'./messages.db.ingested.json',
		)
		.option('-a, --attachments <dir...>', 'attachment root directories')
		.option('--contact <handle>', 'filter to specific contact handle')
		.action(async (options: IngestDBOptions) => {
			try {
				await executeIngestDB(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Failed to ingest DB export:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('ingest-error', {
					command: 'ingest-db',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					options: { output: options.output, contact: options.contact },
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
