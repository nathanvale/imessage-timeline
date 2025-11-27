#!/usr/bin/env node

/**
 * iMessage Timeline CLI
 *
 * Main entry point for the CLI using commander.js.
 * Implements CLI--T01: Setup Commander.js Structure
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command, type CommanderError } from 'commander'

import type { DBMessage } from './ingest/ingest-db.js'
import type { Message } from './schema/message.js'

import {
	humanError,
	humanInfo,
	humanWarn,
	setHumanLoggingEnabled,
} from '#utils/human'
import { createLogger, setCorrelationId, setLogLevel } from '#utils/logger'

// Get package.json for version
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = resolve(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

// ============================================================================
// CLI--T01-AC02: Create main program with version, description, global options
// ============================================================================

const program = new Command()
const cliLogger = createLogger('cli')

function applyLogLevel(verbose: boolean, quiet: boolean): void {
	const level = quiet ? 'error' : verbose ? 'debug' : 'info'
	setLogLevel(level)
}

// Helper to emit structured CLI events alongside human output when desired
type CLILogMeta = {
	command: string
	phase: 'start' | 'progress' | 'summary' | 'warning' | 'error'
	message?: string
	options?: Record<string, unknown>
	metrics?: Record<string, unknown>
	error?: { type?: string; message: string; stack?: string }
	context?: Record<string, unknown>
	exitCode?: number
}

// Exported for potential test usage
function logEvent(event: string, meta: CLILogMeta): void {
	cliLogger.info(event, meta)
}

// CLI option types
type RenderMarkdownOptions = {
	input: string
	output?: string
	startDate?: string
	endDate?: string
	groupByTime?: boolean
	nestedReplies?: boolean
	maxNestingDepth?: string
}

type ValidateOptions = { input: string; quiet?: boolean }
type StatsOptions = { input: string; verbose?: boolean }
type CleanOptions = { checkpointDir: string; force?: boolean; all?: boolean }
type DoctorOptions = { verbose?: boolean }
type InitOptions = { format: 'json' | 'yaml'; force: boolean; output?: string }
type IngestCSVOptions = {
	input: string
	output: string
	attachments?: Array<string>
}
type IngestDBOptions = {
	input: string
	output: string
	attachments?: Array<string>
	contact?: string
}
type NormalizeLinkOptions = {
	input: Array<string> | string
	output: string
	mergeMode: string
}
type EnrichAIOptions = {
	input: string
	output: string
	checkpointDir: string
	resume?: boolean
	incremental?: boolean
	stateFile?: string
	resetState?: boolean
	forceRefresh?: boolean
	rateLimitMs?: string
	maxRetries?: string
	checkpointInterval?: string
	enableVision?: boolean
	enableAudio?: boolean
	enableLinks?: boolean
}

program
	.name('imessage-timeline')
	.version(packageJson.version)
	.description(
		'Extract, transform, and analyze iMessage conversations with AI-powered enrichment and timeline rendering',
	)

// ============================================================================
// CLI--T01-AC03: Global options: --verbose, --quiet, --config <path>
// ============================================================================

program
	.option('-v, --verbose', 'enable verbose logging', false)
	.option('-q, --quiet', 'suppress non-error output', false)
	.option('-c, --config <path>', 'path to config file', 'imessage-config.json')
	.option(
		'--json',
		'emit structured JSON log events only (machine-readable)',
		false,
	)

// Toggle human logging before each command action
program.hook('preAction', () => {
	const opts = program.opts<{ json?: boolean }>()
	const envJson = String(process.env.IMESSAGE_JSON || '').toLowerCase()
	const envJsonOnly = ['1', 'true', 'yes', 'y', 'json', 'json-only'].includes(
		envJson,
	)
	const jsonOnly = Boolean(opts.json) || envJsonOnly
	setHumanLoggingEnabled(!jsonOnly)
})

// ============================================================================
// CLI--T01-AC05: Top-level error handler with user-friendly messages
// ============================================================================

program.configureOutput({
	outputError: (str: string, write: (msg: string) => void) => {
		const errorMsg = str
			.replace(/^error: /, '❌ Error: ')
			.replace(/^Error: /, '❌ Error: ')
		write(errorMsg)
		cliLogger.error('Commander output error', { raw: str })
	},
})

// Custom error handler for better error messages
program.exitOverride((err: CommanderError) => {
	// Allow help and version to exit cleanly
	if (err.code === 'commander.help') {
		process.exit(0)
	}
	if (err.code === 'commander.version') {
		process.exit(0)
	}

	// Handle missing required options
	if (err.code === 'commander.missingArgument') {
		humanError(`❌ Error: ${err.message}`)
		humanError(
			`\nRun 'imessage-timeline ${program.args[0] || ''} --help' for usage information`,
		)
		process.exit(1)
	}

	// Handle unknown commands
	if (err.code === 'commander.unknownCommand') {
		humanError(`❌ Error: ${err.message}`)
		humanError(`\nRun 'imessage-timeline --help' to see available commands`)
		process.exit(1)
	}

	// Generic error handler
	humanError(`❌ Error: ${err.message}`)
	cliLogger.error('CLI exit override error', {
		code: err.code,
		message: err.message,
	})
	process.exit(err.exitCode || 1)
})

// ============================================================================
// Placeholder Commands (to be implemented in CLI--T02, CLI--T03, CLI--T04, CLI--T05)
// ============================================================================

// ============================================================================
// Ingest commands (CLI--T02)
// ============================================================================

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
		const { input, output, attachments } = options
		const verbose = program.opts().verbose
		applyLogLevel(verbose, program.opts().quiet)
		setCorrelationId(`ingest-csv:${Date.now().toString(36)}`)
		logEvent('ingest-start', {
			command: 'ingest-csv',
			phase: 'start',
			options: { input, output, attachmentsCount: attachments?.length },
		})

		try {
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
			const { ingestCSV, createExportEnvelope, validateMessages } =
				await import('./ingest/ingest-csv.js')

			if (verbose) {
				cliLogger.info('Reading CSV ingest', { input, attachmentRoots })
			}

			const messages = ingestCSV(input, { attachmentRoots })

			// CLI-T02-AC05: Progress output: ✓ Parsed 2,847 messages from CSV
			humanInfo(
				`✓ Parsed ${messages.length.toLocaleString()} messages from CSV`,
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

			humanInfo(
				`✓ Wrote ${messages.length.toLocaleString()} messages to ${output}`,
			)
			humanInfo('\n📊 Summary:')
			const textCount = messages.filter((m) => m.messageKind === 'text').length
			const mediaCount = messages.filter(
				(m) => m.messageKind === 'media',
			).length
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
			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Failed to ingest CSV:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('ingest-error', {
				command: 'ingest-csv',
				phase: 'error',
				error: errorMeta,
				exitCode: 2,
			})
			process.exit(2)
		}
	})

program
	.command('ingest-db')
	.description('Import messages from macOS Messages.app database export (JSON)')
	.requiredOption('-i, --input <path>', 'path to JSON file with DB messages')
	.option(
		'-o, --output <path>',
		'output JSON file path',
		'./messages.db.ingested.json',
	)
	.option('-a, --attachments <dir...>', 'attachment root directories')
	.option('--contact <handle>', 'filter to specific contact handle')
	.action(async (options: IngestDBOptions) => {
		const { input, output, attachments, contact } = options
		const verbose = program.opts().verbose
		applyLogLevel(verbose, program.opts().quiet)
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

		try {
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
			const { splitDBMessage } = await import('./ingest/ingest-db.js')
			const { createExportEnvelope, validateMessages } = await import(
				'./ingest/ingest-csv.js'
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
				filteredMessages = dbMessages.filter(
					(m: DBMessage) => m.handle === contact,
				)
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

			humanInfo(
				`✓ Wrote ${messages.length.toLocaleString()} messages to ${output}`,
			)
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
			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Failed to ingest DB export:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('ingest-error', {
				command: 'ingest-db',
				phase: 'error',
				error: errorMeta,
				options: { output, contact },
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// Normalize command (CLI--T03-AC01)
program
	.command('normalize-link')
	.description('Deduplicate and link messages from multiple sources')
	.requiredOption(
		'-i, --input <files...>',
		'input JSON files (CSV, DB, or both)',
	)
	.option(
		'-o, --output <path>',
		'output JSON file path',
		'./messages.normalized.json',
	)
	.option(
		'-m, --merge-mode <mode>',
		'merge mode: exact|content|all (default: all)',
		'all',
	)
	.action(async (options: NormalizeLinkOptions) => {
		const { input, output, mergeMode } = options
		const verbose = program.opts().verbose
		applyLogLevel(verbose, program.opts().quiet)

		try {
			// Validate inputs
			const fs = await import('node:fs')
			const inputFiles = Array.isArray(input) ? input : [input]

			for (const file of inputFiles) {
				if (!fs.existsSync(file)) {
					humanError(`❌ Input file not found: ${file}`)
					process.exit(1)
				}
			}

			// CLI-T03-AC01: Validate merge mode
			if (!['exact', 'content', 'all'].includes(mergeMode)) {
				humanError(`❌ Invalid merge mode: ${mergeMode}`)
				humanError(
					'Valid modes: exact (GUID only), content (text matching), all (both)',
				)
				process.exit(1)
			}

			if (verbose) {
				cliLogger.info('Start normalize-link', {
					files: inputFiles.length,
					mergeMode,
				})
			}

			// Load input files
			const allMessages: Message[] = []
			for (const file of inputFiles) {
				const content = fs.readFileSync(file, 'utf-8')
				const data = JSON.parse(content)
				const messages = Array.isArray(data) ? data : data.messages || []
				allMessages.push(...messages)
				humanInfo(`✓ Loaded ${messages.length} messages from ${file}`)
			}

			// Import normalize pipeline
			const { linkRepliesToParents } = await import(
				'./ingest/link-replies-and-tapbacks.js'
			)
			const { dedupAndMerge } = await import('./ingest/dedup-merge.js')
			const { validateNormalizedMessages } = await import(
				'./normalize/validate-normalized.js'
			)

			if (verbose) {
				cliLogger.info('Total messages before linking', {
					count: allMessages.length,
				})
			}

			// Step 1: Link replies and tapbacks
			const linkedResult = linkRepliesToParents(allMessages, {
				trackAmbiguous: true,
			})
			const linkedMessages = Array.isArray(linkedResult)
				? linkedResult
				: linkedResult.messages

			if (
				verbose &&
				!Array.isArray(linkedResult) &&
				linkedResult.ambiguousLinks
			) {
				cliLogger.warn('Ambiguous reply/tapback links detected', {
					count: linkedResult.ambiguousLinks.length,
				})
			}

			// Step 2: Deduplicate and merge (if multiple sources)
			let normalizedMessages: Message[] = linkedMessages
			if (inputFiles.length > 1) {
				// Split messages by source for dedup-merge
				const csvMessages = linkedMessages.filter(
					(m: Message) => m.exportVersion?.includes('csv') || !m.rowid,
				)
				const dbMessages = linkedMessages.filter(
					(m: Message) => m.rowid !== undefined,
				)

				const mergeResult = dedupAndMerge(csvMessages, dbMessages)
				normalizedMessages = mergeResult.messages

				if (verbose) {
					cliLogger.info('Merge statistics', {
						input: mergeResult.stats.csvCount + mergeResult.stats.dbCount,
						output: mergeResult.stats.outputCount,
						exactMatches: mergeResult.stats.exactMatches,
						contentMatches: mergeResult.stats.contentMatches,
						noMatches: mergeResult.stats.noMatches,
					})
				}
			}

			// Step 3: Validate normalized messages
			const validatedMessages = validateNormalizedMessages(normalizedMessages)

			// Write output envelope
			const { createExportEnvelope } = await import('./ingest/ingest-csv.js')
			const envelope = createExportEnvelope(validatedMessages)
			envelope.source = 'merged'

			fs.writeFileSync(output, JSON.stringify(envelope, null, 2), 'utf-8')

			humanInfo(
				`\n✅ Normalized ${validatedMessages.length.toLocaleString()} messages`,
			)
			humanInfo(`✓ Wrote to ${output}`)
			humanInfo('\n📊 Final Summary:')
			const nText = validatedMessages.filter(
				(m: Message) => m.messageKind === 'text',
			).length
			const nMedia = validatedMessages.filter(
				(m: Message) => m.messageKind === 'media',
			).length
			const nTapbacks = validatedMessages.filter(
				(m: Message) => m.messageKind === 'tapback',
			).length
			const nNotifs = validatedMessages.filter(
				(m: Message) => m.messageKind === 'notification',
			).length
			humanInfo(`  Text: ${nText}`)
			humanInfo(`  Media: ${nMedia}`)
			humanInfo(`  Tapbacks: ${nTapbacks}`)
			humanInfo(`  Notifications: ${nNotifs}`)
			logEvent('normalize-summary', {
				command: 'normalize-link',
				phase: 'summary',
				metrics: {
					total: validatedMessages.length,
					text: nText,
					media: nMedia,
					tapbacks: nTapbacks,
					notifications: nNotifs,
				},
				options: { output },
				exitCode: 0,
			})

			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Failed to normalize-link:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('normalize-error', {
				command: 'normalize-link',
				phase: 'error',
				error: errorMeta,
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// Enrich command (CLI--T03-AC02, AC03, AC04, AC05)
program
	.command('enrich-ai')
	.description('Add AI-powered enrichment to media messages')
	.requiredOption('-i, --input <path>', 'input normalized JSON file')
	.option(
		'-o, --output <path>',
		'output JSON file path',
		'./messages.enriched.json',
	)
	.option(
		'-c, --checkpoint-dir <path>',
		'checkpoint directory',
		'./.checkpoints',
	)
	.option('--resume', 'resume from last checkpoint', false)
	.option(
		'--incremental',
		'only enrich messages new since last enrichment run',
		false,
	)
	.option(
		'--state-file <path>',
		'path to incremental state file (auto-detects .imessage-state.json by default)',
	)
	.option(
		'--reset-state',
		'clear incremental state and enrich all messages',
		false,
	)
	.option('--force-refresh', 'force re-enrichment even if already done', false)
	.option('--rate-limit <ms>', 'delay between API calls (milliseconds)', '1000')
	.option('--max-retries <n>', 'max retries on API errors', '3')
	.option('--checkpoint-interval <n>', 'write checkpoint every N items', '100')
	.option('--enable-vision', 'enable image analysis with Gemini Vision', true)
	.option(
		'--enable-audio',
		'enable audio transcription with Gemini Audio',
		true,
	)
	.option('--enable-links', 'enable link enrichment with Firecrawl', true)
	.action(async (options: EnrichAIOptions) => {
		const {
			input,
			output,
			checkpointDir,
			resume,
			incremental,
			stateFile: userProvidedStateFile,
			resetState,
			forceRefresh: _forceRefresh,
			rateLimitMs,
			maxRetries,
			checkpointInterval,
			enableVision,
			enableAudio,
			enableLinks,
		} = options
		const verbose = program.opts().verbose
		applyLogLevel(verbose, program.opts().quiet)
		logEvent('enrich-start', {
			command: 'enrich',
			phase: 'start',
			options: {
				input,
				output,
				checkpointDir,
				resume,
				incremental,
				stateFile: userProvidedStateFile,
				resetState,
				rateLimitMs,
				maxRetries,
				checkpointInterval,
				enableVision,
				enableAudio,
				enableLinks,
			},
		})

		try {
			// Validate inputs
			const fs = await import('node:fs')
			if (!fs.existsSync(input)) {
				humanError(`❌ Input file not found: ${input}`)
				process.exit(1)
			}

			// Parse rate limit and retry options
			const rateLimitDelay = Number.parseInt(rateLimitMs as string, 10)
			const maxRetriesNum = Number.parseInt(maxRetries as string, 10)
			const checkpointIntervalNum = Number.parseInt(
				checkpointInterval as string,
				10,
			)

			if (Number.isNaN(rateLimitDelay) || rateLimitDelay < 0) {
				humanError(
					'❌ --rate-limit must be a non-negative number (milliseconds)',
				)
				process.exit(1)
			}
			if (Number.isNaN(maxRetriesNum) || maxRetriesNum < 0) {
				humanError('❌ --max-retries must be a non-negative number')
				process.exit(1)
			}
			if (Number.isNaN(checkpointIntervalNum) || checkpointIntervalNum < 1) {
				humanError('❌ --checkpoint-interval must be a positive number')
				process.exit(1)
			}

			if (verbose) {
				cliLogger.info('Enrich config', {
					input,
					output,
					checkpointDir,
					rateLimitDelay,
					maxRetries: maxRetriesNum,
					checkpointInterval: checkpointIntervalNum,
					enableVision,
					enableAudio,
					enableLinks,
					incremental,
				})
			}

			// Create checkpoint directory if needed
			if (!fs.existsSync(checkpointDir)) {
				await import('node:fs/promises').then((fsp) =>
					fsp.mkdir(checkpointDir, { recursive: true }),
				)
			}

			// Load normalized messages
			const content = fs.readFileSync(input, 'utf-8')
			const data = JSON.parse(content)
			const messages = Array.isArray(data) ? data : data.messages || []

			humanInfo(`✓ Loaded ${messages.length.toLocaleString()} messages`)

			// Import enrichment modules
			const {
				loadCheckpoint,
				computeConfigHash,
				saveCheckpoint,
				createCheckpoint,
			} = await import('./enrich/checkpoint.js')

			// Import actual enrichment functions
			const { analyzeImage } = await import('./enrich/image-analysis.js')
			const { analyzeAudio } = await import('./enrich/audio-transcription.js')
			const { enrichLinkContext } = await import('./enrich/link-enrichment.js')
			const { createRateLimiter } = await import('./enrich/rate-limiting.js')

			// Create rate limiter with circuit breaker
			const rateLimiter = createRateLimiter({
				rateLimitDelay,
				maxRetries: maxRetriesNum,
				circuitBreakerThreshold: 5,
				circuitBreakerResetMs: 60000,
			})

			// Compute config hash for checkpoint verification (AC05: Config consistency)
			const enrichConfig = {
				enableVisionAnalysis: enableVision,
				enableLinkAnalysis: enableLinks,
				enableAudioTranscription: enableAudio,
				rateLimitDelay,
				maxRetries: maxRetriesNum,
			}
			const configHash = computeConfigHash(enrichConfig)
			const checkpointPath = `${checkpointDir}/enrich-checkpoint-${configHash}.json`

			// INCREMENTAL--T04-AC02/AC03: Handle incremental state file
			const stateFilePath = userProvidedStateFile || '.imessage-state.json'
			const stateFileExists = fs.existsSync(stateFilePath)

			// INCREMENTAL--T04-AC04: Handle --reset-state flag
			if (resetState && stateFileExists) {
				fs.unlinkSync(stateFilePath)
				if (verbose) {
					humanInfo(`🗑️  Reset incremental state file: ${stateFilePath}`)
				}
			}

			// Import incremental state module for AC02, AC03, AC04, AC05
			const { loadIncrementalState, detectNewMessages } = await import(
				'./utils/incremental-state.js'
			)

			// INCREMENTAL--T04-AC02: Auto-detect state file and load previous state
			let previousState: Awaited<
				ReturnType<typeof loadIncrementalState>
			> | null = null
			let newMessageGuids: string[] = []
			let newMessageCount = messages.length

			if (incremental && stateFileExists && !resetState) {
				previousState = await loadIncrementalState(stateFilePath)
				if (previousState) {
					// Detect new messages using GUID comparison
					const currentGuids = new Set(
						(messages as Message[])
							.map((m: Message) => m.guid)
							.filter((g: string | undefined): g is string => Boolean(g)),
					)
					newMessageGuids = detectNewMessages(currentGuids, previousState)
					newMessageCount = newMessageGuids.length
					if (verbose) {
						humanInfo(
							`♻️  Incremental mode: detected ${newMessageCount.toLocaleString()} new messages`,
						)
						humanInfo(`   Total messages: ${messages.length.toLocaleString()}`)
					}
				}
			} else if (incremental && !stateFileExists && !resetState) {
				if (verbose) {
					humanInfo(
						`♻️  Incremental mode enabled but no state file found: ${stateFilePath}`,
					)
					humanInfo(
						`   Enriching all ${messages.length.toLocaleString()} messages`,
					)
				}
			}

			// AC05: Load checkpoint and verify config hash
			let startIndex = 0
			if (resume) {
				const checkpoint = await loadCheckpoint(checkpointPath)
				if (checkpoint) {
					if (checkpoint.configHash !== configHash) {
						humanError('❌ Config has changed since last checkpoint')
						humanError(
							'Use --force-refresh to re-enrich or delete checkpoint file',
						)
						process.exit(1)
					}
					startIndex = checkpoint.lastProcessedIndex + 1
					cliLogger.info('Resuming from checkpoint', {
						startIndex,
						alreadyProcessed: checkpoint.totalProcessed,
						failedItems: checkpoint.totalFailed,
					})
				} else if (resume) {
					humanWarn('⚠️  No checkpoint found, starting from beginning')
				}
			}

			// AC02: Enrich messages with checkpoint support
			const enrichedMessages: Message[] = []
			let totalProcessed = 0
			let totalFailed = 0
			const failedItems: Array<{
				index: number
				guid: string
				kind: string
				error: string
			}> = []

			// INCREMENTAL--T04-AC05: Show progress with new message count
			const progressMsg =
				incremental && newMessageCount < messages.length
					? `Enriching ${newMessageCount.toLocaleString()} new messages (${messages.length.toLocaleString()} total)`
					: `Processing ${messages.length.toLocaleString()} messages`
			humanInfo(`\n🚀 Starting enrichment: ${progressMsg}`)

			// Build enrichment configs
			const geminiApiKey = process.env.GEMINI_API_KEY || ''
			const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

			const imageConfig = {
				enableVisionAnalysis: enableVision ?? true,
				geminiApiKey,
				geminiModel: 'gemini-1.5-pro',
				imageCacheDir: '/tmp/image-cache',
			}

			const audioConfig = {
				enableAudioTranscription: enableAudio ?? true,
				geminiApiKey,
				geminiModel: 'gemini-1.5-pro',
				rateLimitDelay,
				maxRetries: maxRetriesNum,
			}

			const linkConfig = {
				enableLinkAnalysis: enableLinks ?? true,
				...(firecrawlApiKey ? { firecrawlApiKey } : {}),
				rateLimitDelay,
				maxRetries: maxRetriesNum,
			}

			// Build set of new message GUIDs for incremental filtering
			const newGuidSet = new Set(newMessageGuids)

			for (let i = startIndex; i < messages.length; i++) {
				const message = messages[i]

				try {
					// INCREMENTAL--T04: Skip already-enriched messages in incremental mode
					const shouldEnrich =
						!incremental || !previousState || newGuidSet.has(message.guid || '')

					let enrichedMessage = message

					if (shouldEnrich) {
						// Check circuit breaker before making API calls
						if (rateLimiter.isCircuitOpen()) {
							// Circuit is open - skip enrichment but don't fail
							if (verbose) {
								humanWarn(
									`⚠️  Circuit breaker open - skipping enrichment for message ${i}`,
								)
							}
						} else {
							// Apply rate limiting delay between API calls
							const rateLimitDelayMs = rateLimiter.shouldRateLimit()
							if (rateLimitDelayMs > 0) {
								await new Promise((resolve) =>
									setTimeout(resolve, rateLimitDelayMs),
								)
							}
							rateLimiter.recordCall()

							// Enrich based on message type and config
							if (
								enableVision &&
								message.messageKind === 'media' &&
								message.media?.mediaKind === 'image'
							) {
								enrichedMessage = await analyzeImage(
									enrichedMessage,
									imageConfig,
								)
								rateLimiter.recordSuccess()
							} else if (
								enableAudio &&
								message.messageKind === 'media' &&
								message.media?.mediaKind === 'audio'
							) {
								enrichedMessage = await analyzeAudio(
									enrichedMessage,
									audioConfig,
								)
								rateLimiter.recordSuccess()
							} else if (
								enableLinks &&
								message.messageKind === 'text' &&
								message.text
							) {
								enrichedMessage = await enrichLinkContext(
									enrichedMessage,
									linkConfig,
								)
								rateLimiter.recordSuccess()
							}
						}
					}

					enrichedMessages.push(enrichedMessage)
					totalProcessed++

					// AC01: Write checkpoint at intervals
					if ((i + 1) % checkpointIntervalNum === 0) {
						const checkpoint = createCheckpoint({
							lastProcessedIndex: i,
							totalProcessed,
							totalFailed,
							stats: {
								processedCount: totalProcessed,
								failedCount: totalFailed,
								enrichmentsByKind: {},
							},
							failedItems,
							configHash,
						})
						await saveCheckpoint(checkpoint, checkpointPath)
						if (verbose) {
							cliLogger.info('Checkpoint written', { index: i + 1 })
						}
					}
				} catch (error) {
					totalFailed++
					const errorMessage =
						error instanceof Error ? error.message : String(error)
					failedItems.push({
						index: i,
						guid: message.guid || 'unknown',
						kind: message.messageKind || 'unknown',
						error: errorMessage,
					})
					if (verbose) {
						humanWarn(`⚠️  Failed to enrich message ${i}: ${errorMessage}`)
						logEvent('enrich-item-failed', {
							command: 'enrich',
							phase: 'warning',
							context: {
								index: i,
								guid: message.guid || 'unknown',
								kind: message.messageKind || 'unknown',
							},
							error: {
								type: error instanceof Error ? error.name : 'Unknown',
								message: errorMessage,
								...(error instanceof Error && error.stack
									? { stack: error.stack }
									: {}),
							},
						})
					}
				}
			}

			// Write final checkpoint
			const finalCheckpoint = createCheckpoint({
				lastProcessedIndex: messages.length - 1,
				totalProcessed,
				totalFailed,
				stats: {
					processedCount: totalProcessed,
					failedCount: totalFailed,
					enrichmentsByKind: {},
				},
				failedItems,
				configHash,
			})
			await saveCheckpoint(finalCheckpoint, checkpointPath)

			// Write output
			const { createExportEnvelope } = await import('./ingest/ingest-csv.js')
			const envelope = createExportEnvelope(enrichedMessages)
			envelope.source = 'merged'
			fs.writeFileSync(output, JSON.stringify(envelope, null, 2), 'utf-8')

			humanInfo('\n✅ Enrichment complete')
			humanInfo(`✓ Processed: ${totalProcessed.toLocaleString()} messages`)
			if (totalFailed > 0) {
				humanInfo(`⚠️  Failed: ${totalFailed.toLocaleString()} messages`)
			}
			humanInfo(`✓ Wrote to ${output}`)
			logEvent('enrich-summary', {
				command: 'enrich',
				phase: 'summary',
				metrics: { processed: totalProcessed, failed: totalFailed },
				options: { output, checkpointInterval: checkpointIntervalNum },
				context: { checkpointPath },
				exitCode: 0,
			})
			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Failed to enrich:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('enrich-error', {
				command: 'enrich',
				phase: 'error',
				error: errorMeta,
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// ============================================================================
// Render command (CLI--T04: Implement Render Command)
// ============================================================================

program
	.command('render-markdown')
	.description('Generate Obsidian-compatible markdown timeline files')
	.requiredOption('-i, --input <path>', 'input enriched JSON file')
	.option(
		'-o, --output <dir>',
		'output directory for markdown files',
		'./timeline',
	)
	.option('--start-date <date>', 'render messages from this date (YYYY-MM-DD)')
	.option('--end-date <date>', 'render messages until this date (YYYY-MM-DD)')
	.option(
		'--group-by-time',
		'group messages by time-of-day (Morning/Afternoon/Evening)',
		true,
	)
	.option('--nested-replies', 'render replies as nested blockquotes', true)
	.option(
		'--max-nesting-depth <n>',
		'maximum nesting depth for replies (default 10)',
		'10',
	)
	.action(async (options: RenderMarkdownOptions) => {
		const {
			input,
			output,
			startDate,
			endDate,
			groupByTime,
			nestedReplies,
			maxNestingDepth,
		} = options
		const verbose = program.opts().verbose
		applyLogLevel(verbose, program.opts().quiet)
		logEvent('render-start', {
			command: 'render-markdown',
			phase: 'start',
			options: {
				input,
				output,
				startDate,
				endDate,
				groupByTime,
				nestedReplies,
				maxNestingDepth,
			},
		})

		try {
			// CLI-T04-AC01: Date filtering validation
			const fs = await import('node:fs')
			if (!fs.existsSync(input)) {
				humanError(`❌ Input file not found: ${input}`)
				process.exit(1)
			}

			let startDateObj: Date | null = null
			let endDateObj: Date | null = null

			if (startDate) {
				const start = new Date(startDate)
				if (Number.isNaN(start.getTime())) {
					humanError(
						`❌ Invalid start date: ${startDate} (use YYYY-MM-DD format)`,
					)
					process.exit(1)
				}
				startDateObj = start
			}

			if (endDate) {
				const end = new Date(endDate)
				if (Number.isNaN(end.getTime())) {
					humanError(`❌ Invalid end date: ${endDate} (use YYYY-MM-DD format)`)
					process.exit(1)
				}
				// Set to end of day
				end.setHours(23, 59, 59, 999)
				endDateObj = end
			}

			// CLI-T04-AC03: Validate max nesting depth
			const maxNestingDepthNum = Number.parseInt(maxNestingDepth as string, 10)
			if (Number.isNaN(maxNestingDepthNum) || maxNestingDepthNum < 1) {
				humanError('❌ --max-nesting-depth must be a positive number')
				process.exit(1)
			}

			if (verbose) {
				humanInfo(`📄 Input: ${input}`)
				humanInfo(`📁 Output directory: ${output}`)
				if (startDateObj) {
					humanInfo(`📅 Start date: ${startDate}`)
				}
				if (endDateObj) {
					humanInfo(`📅 End date: ${endDate}`)
				}
				humanInfo(`⏱️  Group by time: ${groupByTime}`)
				humanInfo(`⬅️  Nested replies: ${nestedReplies}`)
				humanInfo(`📊 Max nesting depth: ${maxNestingDepthNum}`)
			}

			// Load input messages
			const content = fs.readFileSync(input, 'utf-8')
			const data = JSON.parse(content)
			let messages: Message[] = Array.isArray(data) ? data : data.messages || []

			if (verbose) {
				humanInfo(`✓ Loaded ${messages.length.toLocaleString()} messages`)
			}

			// Filter by date range if specified
			if (startDateObj || endDateObj) {
				const filtered = messages.filter((msg) => {
					const msgDate = new Date(msg.date)
					if (startDateObj && msgDate < startDateObj) return false
					if (endDateObj && msgDate > endDateObj) return false
					return true
				})
				humanInfo(
					`📊 Filtered to ${filtered.length.toLocaleString()} messages in date range`,
				)
				logEvent('render-filtered', {
					command: 'render-markdown',
					phase: 'progress',
					metrics: { filtered: filtered.length, original: messages.length },
					options: {
						startDate: startDateObj ? startDateObj.toISOString() : undefined,
						endDate: endDateObj ? endDateObj.toISOString() : undefined,
					},
				})
				messages = filtered
			}

			// Import render functions
			const { renderMessages } = await import('./render/index.js')

			// Render messages to markdown
			const rendered = renderMessages(messages)

			if (rendered.size === 0) {
				humanWarn('⚠️  No messages to render')
				process.exit(0)
			}

			// CLI-T04-AC04: Create output directory if doesn't exist
			const path = await import('node:path')
			const outputDir = path.resolve(output || './timeline')

			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true })
				if (verbose) {
					cliLogger.info('Created output directory', { outputDir })
				}
			}

			// Write markdown files
			let filesWritten = 0
			const dates = Array.from(rendered.keys()).sort()

			for (const date of dates) {
				const markdown = rendered.get(date)
				if (!markdown) continue

				const filename = `${date}.md`
				const filepath = path.join(outputDir, filename)

				fs.writeFileSync(filepath, markdown, 'utf-8')
				filesWritten++

				if (verbose) {
					humanInfo(`✓ Wrote ${filename}`)
					logEvent('render-file-written', {
						command: 'render-markdown',
						phase: 'progress',
						metrics: { filesWritten },
						context: { filename, filepath },
					})
				}
			}

			// CLI-T04-AC05: Summary output
			humanInfo(`\n✅ Rendered ${filesWritten} markdown file(s)`)
			humanInfo(
				`✓ Wrote ${filesWritten.toLocaleString()} markdown file${filesWritten === 1 ? '' : 's'} to ${outputDir}`,
			)

			// Message summary
			const textMessages = messages.filter(
				(m) => m.messageKind === 'text',
			).length
			const mediaMessages = messages.filter(
				(m) => m.messageKind === 'media',
			).length
			const tapbacks = messages.filter(
				(m) => m.messageKind === 'tapback',
			).length

			humanInfo('\n📊 Message Summary:')
			humanInfo(`  Total: ${messages.length.toLocaleString()}`)
			humanInfo(`  Text: ${textMessages.toLocaleString()}`)
			humanInfo(`  Media: ${mediaMessages.toLocaleString()}`)
			humanInfo(`  Tapbacks: ${tapbacks.toLocaleString()}`)
			logEvent('render-summary', {
				command: 'render-markdown',
				phase: 'summary',
				metrics: {
					filesWritten,
					totalMessages: messages.length,
					textMessages,
					mediaMessages,
					tapbacks,
				},
				options: {
					outputDir,
					groupByTime,
					nestedReplies,
					maxNestingDepth: maxNestingDepthNum,
				},
				exitCode: 0,
			})

			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Failed to render markdown:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('render-error', {
				command: 'render-markdown',
				phase: 'error',
				error: errorMeta,
				options: { output, groupByTime, nestedReplies, maxNestingDepth },
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// ============================================================================
// Helper commands (CLI--T05)
// ============================================================================

// CLI--T05-AC01: validate command to check JSON against schema
program
	.command('validate')
	.description('Validate JSON file against message schema')
	.requiredOption('-i, --input <path>', 'path to JSON file to validate')
	.option('-q, --quiet', 'suppress detailed error messages', false)
	.action(async (options: ValidateOptions) => {
		const { input, quiet } = options
		const _verbose = program.opts().verbose
		applyLogLevel(_verbose, program.opts().quiet)

		try {
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
			const { MessageSchema } = await import('./schema/message.js')
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
						grouped
							.get(err.index)!
							.push({ path: err.path, message: err.message })
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
		} catch (error) {
			humanError(
				'❌ Validation failed:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('validate-runtime-error', {
				command: 'validate',
				phase: 'error',
				error: errorMeta,
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// CLI--T05-AC02: stats command to show message counts by type
program
	.command('stats')
	.description('Show statistics for message file')
	.requiredOption('-i, --input <path>', 'path to message JSON file')
	.option('-v, --verbose', 'show detailed statistics', false)
	.action(async (options: StatsOptions) => {
		const { input } = options
		const verbose = program.opts().verbose || options.verbose
		applyLogLevel(verbose, program.opts().quiet)
		logEvent('stats-start', {
			command: 'stats',
			phase: 'start',
			options: { input },
		})

		try {
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
			} catch {
				humanError(`❌ Invalid JSON: ${input}`)
				process.exit(1)
			}

			// Extract messages
			const messages = Array.isArray(data)
				? data
				: (data as { messages?: Message[] }).messages || []

			// Count by messageKind
			const stats = {
				total: messages.length,
				text: 0,
				media: 0,
				tapback: 0,
				notification: 0,
				withMedia: 0,
				withEnrichment: 0,
				dateRange: { min: null as string | null, max: null as string | null },
			}

			const senders = new Set<string>()
			let totalEnrichments = 0

			messages.forEach((msg: Message) => {
				if (msg.messageKind === 'text') stats.text++
				if (msg.messageKind === 'media') stats.media++
				if (msg.messageKind === 'tapback') stats.tapback++
				if (msg.messageKind === 'notification') stats.notification++

				if (msg.media) {
					stats.withMedia++
					if (msg.media.enrichment && Array.isArray(msg.media.enrichment)) {
						stats.withEnrichment++
						totalEnrichments += msg.media.enrichment.length
					}
				}

				const sender = msg.handle ?? (msg.isFromMe ? 'Me' : 'Unknown')
				senders.add(sender)

				if (msg.date) {
					if (!stats.dateRange.min || msg.date < stats.dateRange.min) {
						stats.dateRange.min = msg.date
					}
					if (!stats.dateRange.max || msg.date > stats.dateRange.max) {
						stats.dateRange.max = msg.date
					}
				}
			})

			// Output summary
			humanInfo('📊 Message Statistics')
			humanInfo(`\n  Total messages: ${stats.total.toLocaleString()}`)
			humanInfo('\n  Message Types:')
			humanInfo(`    Text: ${stats.text}`)
			humanInfo(`    Media: ${stats.media}`)
			humanInfo(`    Tapbacks: ${stats.tapback}`)
			humanInfo(`    Notifications: ${stats.notification}`)

			humanInfo('\n  Enrichment:')
			humanInfo(`    Messages with media: ${stats.withMedia}`)
			humanInfo(`    Messages with enrichment: ${stats.withEnrichment}`)
			if (stats.withEnrichment > 0) {
				humanInfo(`    Total enrichments: ${totalEnrichments}`)
				humanInfo(
					`    Avg enrichments per message: ${(totalEnrichments / stats.withEnrichment).toFixed(2)}`,
				)
			}

			humanInfo('\n  Date Range:')
			if (stats.dateRange.min && stats.dateRange.max) {
				humanInfo(`    From: ${stats.dateRange.min}`)
				humanInfo(`    To: ${stats.dateRange.max}`)

				const minDate = new Date(stats.dateRange.min)
				const maxDate = new Date(stats.dateRange.max)
				const days = Math.floor(
					(maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24),
				)
				humanInfo(`    Duration: ${days + 1} days`)
			} else {
				humanInfo('    None')
			}

			if (verbose) {
				humanInfo(`\n  Participants: ${senders.size}`)
				if (senders.size > 0 && senders.size <= 20) {
					Array.from(senders)
						.sort()
						.forEach((sender) => {
							const count = messages.filter((m: Message) => {
								const msgSender = m.handle ?? (m.isFromMe ? 'Me' : 'Unknown')
								return msgSender === sender
							}).length
							humanInfo(`    ${sender}: ${count}`)
						})
				}
			}

			logEvent('stats-summary', {
				command: 'stats',
				phase: 'summary',
				metrics: {
					total: stats.total,
					text: stats.text,
					media: stats.media,
					tapback: stats.tapback,
					notification: stats.notification,
					withMedia: stats.withMedia,
					withEnrichment: stats.withEnrichment,
					participants: senders.size,
				},
				options: { input, verbose },
				exitCode: 0,
			})
			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Stats failed:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('stats-error', {
				command: 'stats',
				phase: 'error',
				error: errorMeta,
				options: { input, verbose },
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// CLI--T05-AC03: clean command to remove checkpoints and temp files
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
		const { checkpointDir, force, all } = options
		const verbose = program.opts().verbose
		applyLogLevel(verbose, program.opts().quiet)

		try {
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
			process.exit(0)
		} catch (error) {
			humanError(
				'❌ Clean failed:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('clean-error', {
				command: 'clean',
				phase: 'error',
				error: errorMeta,
				options: { checkpointDir, all },
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// CLI--T05-AC04: doctor command to diagnose common issues
program
	.command('doctor')
	.description('Diagnose common configuration issues')
	.option('-v, --verbose', 'show detailed diagnostics', false)
	.action(async (options: DoctorOptions) => {
		const verbose = program.opts().verbose || options.verbose
		applyLogLevel(verbose, program.opts().quiet)

		try {
			const fs = await import('node:fs')
			const path = await import('node:path')
			const os = await import('node:os')

			humanInfo('🔍 iMessage Timeline Diagnostics\n')
			logEvent('doctor-start', { command: 'doctor', phase: 'start' })

			const checks: Array<{ name: string; pass: boolean; message: string }> = []

			// Check 1: Node version
			const nodeVersion = process.version
			const nodeMajor = Number.parseInt(
				nodeVersion.slice(1).split('.')[0] ?? '0',
				10,
			)
			const nodeOk = nodeMajor >= 18
			checks.push({
				name: 'Node.js version',
				pass: nodeOk,
				message: `${nodeVersion} ${nodeOk ? '✓' : '(requires ≥18)'}`,
			})

			// Check 2: Current directory
			const cwd = process.cwd()
			const packageJsonExists = fs.existsSync(path.join(cwd, 'package.json'))
			checks.push({
				name: 'package.json',
				pass: packageJsonExists,
				message: packageJsonExists
					? `Found in ${cwd}`
					: 'Not found in current directory',
			})

			// Check 3: Config file
			const configFormats = [
				'imessage-config.yaml',
				'imessage-config.yml',
				'imessage-config.json',
			]
			const foundConfig = configFormats.find((f) =>
				fs.existsSync(path.join(cwd, f)),
			)
			checks.push({
				name: 'Config file',
				pass: Boolean(foundConfig),
				message: foundConfig
					? `Found: ${foundConfig}`
					: 'Not found (run: imessage-timeline init)',
			})

			// Check 4: API Keys
			const geminiKey = process.env.GEMINI_API_KEY
			const firecrawlKey = process.env.FIRECRAWL_API_KEY
			checks.push({
				name: 'GEMINI_API_KEY',
				pass: Boolean(geminiKey),
				message: geminiKey
					? 'Set'
					: 'Not set (required for image/audio enrichment)',
			})

			checks.push({
				name: 'FIRECRAWL_API_KEY',
				pass: Boolean(firecrawlKey),
				message: firecrawlKey
					? 'Set'
					: 'Not set (optional, improves link enrichment - get from firecrawl.dev)',
			})

			// Check 5: Default attachment directory
			const defaultAttachDir = path.join(
				os.homedir(),
				'Library',
				'Messages',
				'Attachments',
			)
			const attachDirExists = fs.existsSync(defaultAttachDir)
			checks.push({
				name: 'Messages attachments',
				pass: attachDirExists,
				message: attachDirExists
					? `Found: ${defaultAttachDir}`
					: `Not found: ${defaultAttachDir}`,
			})

			// Check 6: Output directory permission
			const canWrite = (() => {
				try {
					const testFile = path.join(cwd, '.test-write')
					fs.writeFileSync(testFile, 'test')
					fs.unlinkSync(testFile)
					return true
				} catch {
					return false
				}
			})()
			checks.push({
				name: 'Write permission',
				pass: canWrite,
				message: canWrite
					? `Can write to ${cwd}`
					: `Cannot write to ${cwd} (check permissions)`,
			})

			// Print results
			let passCount = 0
			checks.forEach((check) => {
				const icon = check.pass ? '✅' : '⚠️ '
				humanInfo(`${icon} ${check.name.padEnd(25)} ${check.message}`)
				if (check.pass) passCount++
				logEvent('doctor-check', {
					command: 'doctor',
					phase: 'progress',
					context: { name: check.name },
					metrics: { pass: check.pass },
					message: check.message,
				})
			})

			humanInfo(`\n📊 Summary: ${passCount}/${checks.length} checks passed`)
			logEvent('doctor-summary', {
				command: 'doctor',
				phase: 'summary',
				metrics: { passed: passCount, total: checks.length },
			})

			// Recommendations
			const failures = checks.filter((c) => !c.pass)
			if (failures.length > 0) {
				humanInfo('\n💡 Recommendations:')
				failures.forEach((check) => {
					if (check.name === 'Config file') {
						humanInfo('   • Run: imessage-timeline init')
					} else if (check.name === 'GEMINI_API_KEY') {
						humanInfo(
							'   • Get API key from: https://ai.google.dev/tutorials/setup',
						)
						humanInfo('   • Set: export GEMINI_API_KEY=your_key')
					} else if (check.name === 'FIRECRAWL_API_KEY') {
						humanInfo('   • (Optional) Get from: https://www.firecrawl.dev')
					}
					logEvent('doctor-recommendation', {
						command: 'doctor',
						phase: 'progress',
						context: { name: check.name },
						message: check.message,
					})
				})
			}

			if (verbose) {
				humanInfo('\n📝 Environment:')
				humanInfo(`   Platform: ${os.platform()}`)
				humanInfo(`   Arch: ${os.arch()}`)
				humanInfo(`   Home: ${os.homedir()}`)
				humanInfo(`   CWD: ${cwd}`)
				logEvent('doctor-environment', {
					command: 'doctor',
					phase: 'progress',
					context: {
						platform: os.platform(),
						arch: os.arch(),
						home: os.homedir(),
						cwd,
					},
				})
			}

			logEvent('doctor-exit', {
				command: 'doctor',
				phase: 'summary',
				metrics: { failures: failures.length },
				exitCode: failures.length > 0 ? 1 : 0,
			})
			process.exit(failures.length > 0 ? 1 : 0)
		} catch (error) {
			humanError(
				'❌ Doctor failed:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('doctor-error', {
				command: 'doctor',
				phase: 'error',
				error: errorMeta,
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// ============================================================================
// Config generation command (CONFIG--T03)
// ============================================================================

program
	.command('init')
	.description('Generate starter configuration file')
	.option('-f, --format <type>', 'config file format (json|yaml)', 'yaml')
	.option('--force', 'overwrite existing config file without prompting', false)
	.option(
		'-o, --output <path>',
		'output file path (default: auto-detected from format)',
	)
	.action(async (options: InitOptions) => {
		const { format, force, output } = options

		// Validate format
		if (format !== 'json' && format !== 'yaml') {
			humanError(`❌ Invalid format: ${format}`)
			humanError('Supported formats: json, yaml')
			process.exit(1)
		}

		try {
			// Lazy import to avoid circular dependencies
			const { generateConfigFile, getDefaultConfigPath, configFileExists } =
				await import('./config/generator.js')

			// Determine output path
			const filePath = output || getDefaultConfigPath(format)

			// CONFIG-T03-AC04: Check for existing file and prompt if needed
			const exists = await configFileExists(filePath)
			if (exists && !force) {
				humanError(`❌ Config file already exists: ${filePath}`)
				humanError('\nOptions:')
				humanError('  • Use --force to overwrite')
				humanError('  • Use --output to specify different path')
				humanError('  • Manually remove the existing file')
				process.exit(1)
			}

			// CONFIG-T03-AC01, AC02, AC03: Generate config file
			const result = await generateConfigFile({
				filePath,
				format,
				force,
			})

			if (result.success) {
				humanInfo(result.message)
				humanInfo('\n📝 Next steps:')
				humanInfo(`  1. Edit ${filePath} to add your API keys`)
				humanInfo('  2. Set GEMINI_API_KEY environment variable')
				humanInfo(
					'  3. (Optional) Set FIRECRAWL_API_KEY for enhanced link scraping',
				)
				humanInfo('\n💡 See inline comments in the config file for details')
				logEvent('init-summary', {
					command: 'init',
					phase: 'summary',
					options: { format, filePath, force },
					message: result.message,
					exitCode: 0,
				})
				process.exit(0)
			} else {
				humanError(`❌ ${result.message}`)
				logEvent('init-error', {
					command: 'init',
					phase: 'error',
					options: { format, filePath, force },
					message: result.message,
					exitCode: 1,
				})
				process.exit(1)
			}
		} catch (error) {
			humanError(
				'❌ Failed to generate config:',
				error instanceof Error ? error.message : String(error),
			)
			if (program.opts().verbose && error instanceof Error) {
				humanError(error.stack)
			}
			const errorMeta: CLILogMeta['error'] = {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			}
			logEvent('init-runtime-error', {
				command: 'init',
				phase: 'error',
				error: errorMeta,
				options: { format, output, force },
				exitCode: 2,
			})
			process.exit(2)
		}
	})

// ============================================================================
// CLI--T01-AC04: Proper exit codes (0=success, 1=validation, 2=runtime)
// ============================================================================

// Global error handler for uncaught errors (guard to prevent duplicate listeners)
const globalAny = globalThis as unknown as Record<string, unknown>
const listenersFlag = '__IMESSAGE_CLI_LISTENERS_ATTACHED__'
if (!globalAny[listenersFlag]) {
	globalAny[listenersFlag] = true

	process.on('uncaughtException', (err) => {
		humanError('❌ Fatal Error:', err.message)
		if (program.opts().verbose) {
			humanError(err.stack)
		}
		logEvent('fatal-error', {
			command: 'global',
			phase: 'error',
			error: {
				type: err.name,
				message: err.message,
				...(err.stack ? { stack: err.stack } : {}),
			},
			exitCode: 2,
		})
		process.exit(2) // Runtime error
	})

	process.on('unhandledRejection', (reason: unknown) => {
		humanError('❌ Unhandled Promise Rejection:', reason)
		logEvent('unhandled-rejection', {
			command: 'global',
			phase: 'error',
			error: { message: String(reason) },
			exitCode: 2,
		})
		process.exit(2) // Runtime error
	})
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
	try {
		await program.parseAsync(process.argv)
	} catch (error) {
		if (error instanceof Error) {
			humanError(`❌ Error: ${error.message}`)
			if (program.opts().verbose) {
				humanError(error.stack)
			}
		} else {
			humanError('❌ Unknown error:', error as unknown as string)
		}
		logEvent('cli-runtime-error', {
			command: 'global',
			phase: 'error',
			error: {
				type: error instanceof Error ? error.name : 'Unknown',
				message: error instanceof Error ? error.message : String(error),
				...(error instanceof Error && error.stack
					? { stack: error.stack }
					: {}),
			},
			exitCode: 1,
		})
		process.exit(1)
	}
}

void main()
