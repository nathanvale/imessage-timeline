/**
 * Stats Command
 *
 * Show statistics for message file.
 * CLI-T05-AC02: stats command to show message counts by type
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import type { Message } from '../../schema/message.js'
import type { GlobalOptions, StatsOptions } from '../types.js'
import { applyLogLevel, logEvent } from '../utils.js'

/**
 * Execute the stats command logic
 */
export async function executeStats(
	options: StatsOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { input } = options
	const verbose = globalOptions.verbose || options.verbose || false

	applyLogLevel(verbose, globalOptions.quiet)

	logEvent('stats-start', {
		command: 'stats',
		phase: 'start',
		options: { input },
	})

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
}

/**
 * Register the stats command with Commander
 */
export function registerStatsCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('stats')
		.description('Show statistics for message file')
		.requiredOption('-i, --input <path>', 'path to message JSON file')
		.option('-v, --verbose', 'show detailed statistics', false)
		.action(async (options: StatsOptions) => {
			try {
				await executeStats(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Stats failed:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('stats-error', {
					command: 'stats',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					options: { input: options.input, verbose: options.verbose },
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
