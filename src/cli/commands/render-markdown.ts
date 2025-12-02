/**
 * Render Markdown Command
 *
 * Generate Obsidian-compatible markdown timeline files.
 * CLI-T04: Implement Render Command
 */

import type { Command } from 'commander'
import { humanError, humanInfo, humanWarn } from '#utils/human'
import type { Message } from '../../schema/message.js'
import type { GlobalOptions, RenderMarkdownOptions } from '../types.js'
import { applyLogLevel, cliLogger, logEvent } from '../utils.js'

/**
 * Execute the render-markdown command logic
 */
export async function executeRenderMarkdown(
	options: RenderMarkdownOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const {
		input,
		output,
		startDate,
		endDate,
		groupByTime,
		nestedReplies,
		maxNestingDepth,
	} = options
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)

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
			humanError(`❌ Invalid start date: ${startDate} (use YYYY-MM-DD format)`)
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
	const { renderMessages } = await import('../../render/index.js')

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
	const textMessages = messages.filter((m) => m.messageKind === 'text').length
	const mediaMessages = messages.filter((m) => m.messageKind === 'media').length
	const tapbacks = messages.filter((m) => m.messageKind === 'tapback').length

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
}

/**
 * Register the render-markdown command with Commander
 */
export function registerRenderMarkdownCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('render-markdown')
		.description('Generate Obsidian-compatible markdown timeline files')
		.requiredOption('-i, --input <path>', 'input enriched JSON file')
		.option(
			'-o, --output <dir>',
			'output directory for markdown files',
			'./timeline',
		)
		.option(
			'--start-date <date>',
			'render messages from this date (YYYY-MM-DD)',
		)
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
			try {
				await executeRenderMarkdown(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Failed to render markdown:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('render-error', {
					command: 'render-markdown',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					options: {
						output: options.output,
						groupByTime: options.groupByTime,
						nestedReplies: options.nestedReplies,
						maxNestingDepth: options.maxNestingDepth,
					},
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
