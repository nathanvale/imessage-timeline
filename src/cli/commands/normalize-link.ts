/**
 * Normalize Link Command
 *
 * Deduplicate and link messages from multiple sources.
 * CLI-T03-AC01: Validate merge mode
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import type { Message } from '../../schema/message.js'
import type { GlobalOptions, NormalizeLinkOptions } from '../types.js'
import { applyLogLevel, cliLogger, logEvent } from '../utils.js'

/**
 * Execute the normalize-link command logic
 */
export async function executeNormalizeLink(
	options: NormalizeLinkOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { input, output, mergeMode } = options
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)

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
		'../../ingest/link-replies-and-tapbacks.js'
	)
	const { dedupAndMerge } = await import('../../ingest/dedup-merge.js')
	const { validateNormalizedMessages } = await import(
		'../../normalize/validate-normalized.js'
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

	if (verbose && !Array.isArray(linkedResult) && linkedResult.ambiguousLinks) {
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
	const { createExportEnvelope } = await import('../../ingest/ingest-csv.js')
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
}

/**
 * Register the normalize-link command with Commander
 */
export function registerNormalizeLinkCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
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
			try {
				await executeNormalizeLink(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Failed to normalize-link:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('normalize-error', {
					command: 'normalize-link',
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
