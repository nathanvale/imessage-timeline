/**
 * Enrich AI Command
 *
 * Add AI-powered enrichment to media messages.
 * CLI-T03-AC02, AC03, AC04, AC05: Enrich with checkpoints, incremental, rate limiting
 */

import type { Command } from 'commander'
import { humanError, humanInfo, humanWarn } from '#utils/human'
import type { Message } from '../../schema/message.js'
import type { EnrichAIOptions, GlobalOptions } from '../types.js'
import { applyLogLevel, cliLogger, logEvent } from '../utils.js'

/**
 * Execute the enrich-ai command logic
 */
export async function executeEnrichAI(
	options: EnrichAIOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
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
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)

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
		humanError('❌ --rate-limit must be a non-negative number (milliseconds)')
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
	} = await import('../../enrich/checkpoint.js')

	// Import actual enrichment functions
	const { analyzeImage } = await import('../../enrich/image-analysis.js')
	const { analyzeAudio } = await import('../../enrich/audio-transcription.js')
	const { enrichLinkContext } = await import('../../enrich/link-enrichment.js')
	const { createRateLimiter } = await import('../../enrich/rate-limiting.js')

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
		'../../utils/incremental-state.js'
	)

	// INCREMENTAL--T04-AC02: Auto-detect state file and load previous state
	let previousState: Awaited<ReturnType<typeof loadIncrementalState>> | null =
		null
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
			humanInfo(`   Enriching all ${messages.length.toLocaleString()} messages`)
		}
	}

	// AC05: Load checkpoint and verify config hash
	let startIndex = 0
	if (resume) {
		const checkpoint = await loadCheckpoint(checkpointPath)
		if (checkpoint) {
			if (checkpoint.configHash !== configHash) {
				humanError('❌ Config has changed since last checkpoint')
				humanError('Use --force-refresh to re-enrich or delete checkpoint file')
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
						enrichedMessage = await analyzeImage(enrichedMessage, imageConfig)
						rateLimiter.recordSuccess()
					} else if (
						enableAudio &&
						message.messageKind === 'media' &&
						message.media?.mediaKind === 'audio'
					) {
						enrichedMessage = await analyzeAudio(enrichedMessage, audioConfig)
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
	const { createExportEnvelope } = await import('../../ingest/ingest-csv.js')
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
}

/**
 * Register the enrich-ai command with Commander
 */
export function registerEnrichAICommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
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
		.option(
			'--force-refresh',
			'force re-enrichment even if already done',
			false,
		)
		.option(
			'--rate-limit <ms>',
			'delay between API calls (milliseconds)',
			'1000',
		)
		.option('--max-retries <n>', 'max retries on API errors', '3')
		.option(
			'--checkpoint-interval <n>',
			'write checkpoint every N items',
			'100',
		)
		.option('--enable-vision', 'enable image analysis with Gemini Vision', true)
		.option(
			'--enable-audio',
			'enable audio transcription with Gemini Audio',
			true,
		)
		.option('--enable-links', 'enable link enrichment with Firecrawl', true)
		.action(async (options: EnrichAIOptions) => {
			try {
				await executeEnrichAI(options, getGlobalOptions())
				process.exit(0)
			} catch (error) {
				humanError(
					'❌ Failed to enrich:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('enrich-error', {
					command: 'enrich',
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
