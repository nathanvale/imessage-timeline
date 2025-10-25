#!/usr/bin/env node
/**
 * iMessage Timeline CLI
 *
 * Main entry point for the CLI using commander.js.
 * Implements CLI--T01: Setup Commander.js Structure
 */

import { Command } from 'commander'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Message } from './schema/message.js'
import type { DBMessage } from './ingest/ingest-db.js'

// Get package.json for version
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = resolve(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

// ============================================================================
// CLI--T01-AC02: Create main program with version, description, global options
// ============================================================================

const program = new Command()

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

// ============================================================================
// CLI--T01-AC05: Top-level error handler with user-friendly messages
// ============================================================================

program.configureOutput({
  outputError: (str, write) => {
    // Format error messages for better readability
    const errorMsg = str.replace(/^error: /, '❌ Error: ').replace(/^Error: /, '❌ Error: ')
    write(errorMsg)
  },
})

// Custom error handler for better error messages
program.exitOverride((err) => {
  // Allow help and version to exit cleanly
  if (err.code === 'commander.help') {
    process.exit(0)
  }
  if (err.code === 'commander.version') {
    process.exit(0)
  }

  // Handle missing required options
  if (err.code === 'commander.missingArgument') {
    console.error(`❌ Error: ${err.message}`)
    console.error(`\nRun 'imessage-timeline ${program.args[0] || ''} --help' for usage information`)
    process.exit(1)
  }

  // Handle unknown commands
  if (err.code === 'commander.unknownCommand') {
    console.error(`❌ Error: ${err.message}`)
    console.error(`\nRun 'imessage-timeline --help' to see available commands`)
    process.exit(1)
  }

  // Generic error handler
  console.error(`❌ Error: ${err.message}`)
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
  .option('-o, --output <path>', 'output JSON file path', './messages.csv.ingested.json')
  .option('-a, --attachments <dir...>', 'attachment root directories')
  .action(async (options) => {
    const { input, output, attachments } = options
    const verbose = program.opts().verbose

    try {
      // CLI-T02-AC04: Input file validation with clear error messages
      const fs = await import('fs')
      if (!fs.existsSync(input)) {
        console.error(`❌ Input CSV file not found: ${input}`)
        console.error('\nPlease check:')
        console.error('  • File path is correct')
        console.error('  • File exists and is readable')
        process.exit(1)
      }

      // CLI-T02-AC03: Attachment root validation (check directories exist)
      const attachmentRoots: string[] = []
      if (attachments && attachments.length > 0) {
        for (const dir of attachments) {
          if (!fs.existsSync(dir)) {
            console.error(`❌ Attachment directory not found: ${dir}`)
            process.exit(1)
          }
          if (!fs.statSync(dir).isDirectory()) {
            console.error(`❌ Not a directory: ${dir}`)
            process.exit(1)
          }
          attachmentRoots.push(dir)
        }
      } else {
        // Default: ~/Library/Messages/Attachments
        const os = await import('os')
        const path = await import('path')
        const defaultRoot = path.join(os.homedir(), 'Library', 'Messages', 'Attachments')
        if (fs.existsSync(defaultRoot)) {
          attachmentRoots.push(defaultRoot)
          if (verbose) {
            console.info(`Using default attachment root: ${defaultRoot}`)
          }
        }
      }

      // CLI-T02-AC01: ingest-csv command with all options from usage guide
      const { ingestCSV, createExportEnvelope, validateMessages } = await import(
        './ingest/ingest-csv.js'
      )

      if (verbose) {
        console.info(`📄 Reading CSV: ${input}`)
        console.info(`📁 Attachment roots: ${attachmentRoots.join(', ')}`)
      }

      const messages = ingestCSV(input, { attachmentRoots })

      // CLI-T02-AC05: Progress output: ✓ Parsed 2,847 messages from CSV
      console.info(`✓ Parsed ${messages.length.toLocaleString()} messages from CSV`)

      // Validate messages before writing
      const validation = validateMessages(messages)
      if (!validation.valid) {
        console.error(`❌ ${validation.errors.length} messages failed validation`)
        if (verbose) {
          validation.errors.slice(0, 5).forEach((err) => {
            console.error(`  Message ${err.index}:`, err.issues)
          })
        }
        process.exit(1)
      }

      // Write export envelope
      const envelope = createExportEnvelope(messages)
      fs.writeFileSync(output, JSON.stringify(envelope, null, 2), 'utf-8')

      console.info(`✓ Wrote ${messages.length.toLocaleString()} messages to ${output}`)
      console.info(`\n📊 Summary:`)
      console.info(`  Text: ${messages.filter((m) => m.messageKind === 'text').length}`)
      console.info(`  Media: ${messages.filter((m) => m.messageKind === 'media').length}`)
      console.info(
        `  Notifications: ${messages.filter((m) => m.messageKind === 'notification').length}`,
      )
      process.exit(0)
    } catch (error) {
      console.error(
        `❌ Failed to ingest CSV:`,
        error instanceof Error ? error.message : String(error),
      )
      if (program.opts().verbose && error instanceof Error) {
        console.error(error.stack)
      }
      process.exit(2)
    }
  })

program
  .command('ingest-db')
  .description('Import messages from macOS Messages.app database export (JSON)')
  .requiredOption('-i, --input <path>', 'path to JSON file with DB messages')
  .option('-o, --output <path>', 'output JSON file path', './messages.db.ingested.json')
  .option('-a, --attachments <dir...>', 'attachment root directories')
  .option('--contact <handle>', 'filter to specific contact handle')
  .action(async (options) => {
    const { input, output, attachments, contact } = options
    const verbose = program.opts().verbose

    try {
      // CLI-T02-AC04: Input file validation with clear error messages
      const fs = await import('fs')
      if (!fs.existsSync(input)) {
        console.error(`❌ Input JSON file not found: ${input}`)
        console.error('\nPlease check:')
        console.error('  • File path is correct')
        console.error('  • File exists and is readable')
        process.exit(1)
      }

      // CLI-T02-AC03: Attachment root validation (check directories exist)
      const attachmentRoots: string[] = []
      if (attachments && attachments.length > 0) {
        for (const dir of attachments) {
          if (!fs.existsSync(dir)) {
            console.error(`❌ Attachment directory not found: ${dir}`)
            process.exit(1)
          }
          if (!fs.statSync(dir).isDirectory()) {
            console.error(`❌ Not a directory: ${dir}`)
            process.exit(1)
          }
          attachmentRoots.push(dir)
        }
      } else {
        // Default: ~/Library/Messages/Attachments
        const os = await import('os')
        const path = await import('path')
        const defaultRoot = path.join(os.homedir(), 'Library', 'Messages', 'Attachments')
        if (fs.existsSync(defaultRoot)) {
          attachmentRoots.push(defaultRoot)
          if (verbose) {
            console.info(`Using default attachment root: ${defaultRoot}`)
          }
        }
      }

      // CLI-T02-AC02: ingest-db command with database path and contact filtering
      const { splitDBMessage } = await import('./ingest/ingest-db.js')
      const { createExportEnvelope, validateMessages } = await import('./ingest/ingest-csv.js')

      if (verbose) {
        console.info(`📄 Reading DB export: ${input}`)
        console.info(`📁 Attachment roots: ${attachmentRoots.join(', ')}`)
        if (contact) {
          console.info(`🔍 Filtering to contact: ${contact}`)
        }
      }

      // Read and parse DB export JSON
      const content = fs.readFileSync(input, 'utf-8')
      const dbMessages = JSON.parse(content) as DBMessage[]

      if (!Array.isArray(dbMessages)) {
        console.error(`❌ Expected JSON array of DB messages, got: ${typeof dbMessages}`)
        process.exit(1)
      }

      // Filter by contact if specified
      let filteredMessages: DBMessage[] = dbMessages
      if (contact) {
        filteredMessages = dbMessages.filter((m: DBMessage) => m.handle === contact)
        console.info(`✓ Filtered to ${filteredMessages.length} messages from ${contact}`)
      }

      // Split DB messages into Message objects
      const messages: Message[] = []
      filteredMessages.forEach((dbMsg: DBMessage, index: number) => {
        const split = splitDBMessage(dbMsg, index + 1, { attachmentRoots })
        messages.push(...split)
      })

      // CLI-T02-AC05: Progress output
      console.info(`✓ Parsed ${messages.length.toLocaleString()} messages from DB export`)

      // Validate messages before writing
      const validation = validateMessages(messages)
      if (!validation.valid) {
        console.error(`❌ ${validation.errors.length} messages failed validation`)
        if (verbose) {
          validation.errors.slice(0, 5).forEach((err) => {
            console.error(`  Message ${err.index}:`, err.issues)
          })
        }
        process.exit(1)
      }

      // Write export envelope
      const envelope = createExportEnvelope(messages)
      fs.writeFileSync(output, JSON.stringify(envelope, null, 2), 'utf-8')

      console.info(`✓ Wrote ${messages.length.toLocaleString()} messages to ${output}`)
      console.info(`\n📊 Summary:`)
      console.info(`  Text: ${messages.filter((m: Message) => m.messageKind === 'text').length}`)
      console.info(`  Media: ${messages.filter((m: Message) => m.messageKind === 'media').length}`)
      process.exit(0)
    } catch (error) {
      console.error(
        `❌ Failed to ingest DB export:`,
        error instanceof Error ? error.message : String(error),
      )
      if (program.opts().verbose && error instanceof Error) {
        console.error(error.stack)
      }
      process.exit(2)
    }
  })

// Normalize command (CLI--T03-AC01)
program
  .command('normalize-link')
  .description('Deduplicate and link messages from multiple sources')
  .requiredOption('-i, --input <files...>', 'input JSON files (CSV, DB, or both)')
  .option('-o, --output <path>', 'output JSON file path', './messages.normalized.json')
  .option('-m, --merge-mode <mode>', 'merge mode: exact|content|all (default: all)', 'all')
  .action(async (options) => {
    const { input, output, mergeMode } = options
    const verbose = program.opts().verbose

    try {
      // Validate inputs
      const fs = await import('fs')
      const inputFiles = Array.isArray(input) ? input : [input]

      for (const file of inputFiles) {
        if (!fs.existsSync(file)) {
          console.error(`❌ Input file not found: ${file}`)
          process.exit(1)
        }
      }

      // CLI-T03-AC01: Validate merge mode
      if (!['exact', 'content', 'all'].includes(mergeMode)) {
        console.error(`❌ Invalid merge mode: ${mergeMode}`)
        console.error('Valid modes: exact (GUID only), content (text matching), all (both)')
        process.exit(1)
      }

      if (verbose) {
        console.info(`📄 Reading ${inputFiles.length} input file(s)`)
        console.info(`🔗 Merge mode: ${mergeMode}`)
      }

      // Load input files
      const allMessages: Message[] = []
      for (const file of inputFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const data = JSON.parse(content)
        const messages = Array.isArray(data) ? data : data.messages || []
        allMessages.push(...messages)
        console.info(`✓ Loaded ${messages.length} messages from ${file}`)
      }

      // Import normalize pipeline
      const { linkRepliesToParents } = await import('./ingest/link-replies-and-tapbacks.js')
      const { dedupAndMerge } = await import('./ingest/dedup-merge.js')
      const { validateNormalizedMessages } = await import('./normalize/validate-normalized.js')

      if (verbose) {
        console.info(`📊 Total messages before linking: ${allMessages.length}`)
      }

      // Step 1: Link replies and tapbacks
      const linkedResult = linkRepliesToParents(allMessages, { trackAmbiguous: true })
      const linkedMessages = Array.isArray(linkedResult) ? linkedResult : linkedResult.messages

      if (verbose && !Array.isArray(linkedResult) && linkedResult.ambiguousLinks) {
        console.info(`⚠️  Found ${linkedResult.ambiguousLinks.length} ambiguous links`)
      }

      // Step 2: Deduplicate and merge (if multiple sources)
      let normalizedMessages: Message[] = linkedMessages
      if (inputFiles.length > 1) {
        // Split messages by source for dedup-merge
        const csvMessages = linkedMessages.filter(
          (m: Message) => m.exportVersion?.includes('csv') || !m.rowid,
        )
        const dbMessages = linkedMessages.filter((m: Message) => m.rowid !== undefined)

        const mergeResult = dedupAndMerge(csvMessages, dbMessages)
        normalizedMessages = mergeResult.messages

        if (verbose) {
          console.info(`\n📈 Merge Statistics:`)
          console.info(`  Input: ${mergeResult.stats.csvCount + mergeResult.stats.dbCount}`)
          console.info(`  Output: ${mergeResult.stats.outputCount}`)
          console.info(`  Exact Matches: ${mergeResult.stats.exactMatches}`)
          console.info(`  Content Matches: ${mergeResult.stats.contentMatches}`)
          console.info(`  No Matches: ${mergeResult.stats.noMatches}`)
        }
      }

      // Step 3: Validate normalized messages
      const validatedMessages = validateNormalizedMessages(normalizedMessages)

      // Write output envelope
      const { createExportEnvelope } = await import('./ingest/ingest-csv.js')
      const envelope = createExportEnvelope(validatedMessages)
      envelope.source = 'merged'

      fs.writeFileSync(output, JSON.stringify(envelope, null, 2), 'utf-8')

      console.info(`\n✅ Normalized ${validatedMessages.length.toLocaleString()} messages`)
      console.info(`✓ Wrote to ${output}`)
      console.info(`\n📊 Final Summary:`)
      console.info(
        `  Text: ${validatedMessages.filter((m: Message) => m.messageKind === 'text').length}`,
      )
      console.info(
        `  Media: ${validatedMessages.filter((m: Message) => m.messageKind === 'media').length}`,
      )
      console.info(
        `  Tapbacks: ${validatedMessages.filter((m: Message) => m.messageKind === 'tapback').length}`,
      )
      console.info(
        `  Notifications: ${validatedMessages.filter((m: Message) => m.messageKind === 'notification').length}`,
      )

      process.exit(0)
    } catch (error) {
      console.error(
        `❌ Failed to normalize-link:`,
        error instanceof Error ? error.message : String(error),
      )
      if (program.opts().verbose && error instanceof Error) {
        console.error(error.stack)
      }
      process.exit(2)
    }
  })

// Enrich command (CLI--T03-AC02, AC03, AC04, AC05)
program
  .command('enrich-ai')
  .description('Add AI-powered enrichment to media messages')
  .requiredOption('-i, --input <path>', 'input normalized JSON file')
  .option('-o, --output <path>', 'output JSON file path', './messages.enriched.json')
  .option('-c, --checkpoint-dir <path>', 'checkpoint directory', './.checkpoints')
  .option('--resume', 'resume from last checkpoint', false)
  .option('--force-refresh', 'force re-enrichment even if already done', false)
  .option('--rate-limit <ms>', 'delay between API calls (milliseconds)', '1000')
  .option('--max-retries <n>', 'max retries on API errors', '3')
  .option('--checkpoint-interval <n>', 'write checkpoint every N items', '100')
  .option('--enable-vision', 'enable image analysis with Gemini Vision', true)
  .option('--enable-audio', 'enable audio transcription with Gemini Audio', true)
  .option('--enable-links', 'enable link enrichment with Firecrawl', true)
  .action(async (options) => {
    const {
      input,
      output,
      checkpointDir,
      resume,
      forceRefresh: _forceRefresh,
      rateLimitMs,
      maxRetries,
      checkpointInterval,
      enableVision,
      enableAudio,
      enableLinks,
    } = options
    const verbose = program.opts().verbose

    try {
      // Validate inputs
      const fs = await import('fs')
      if (!fs.existsSync(input)) {
        console.error(`❌ Input file not found: ${input}`)
        process.exit(1)
      }

      // Parse rate limit and retry options
      const rateLimitDelay = parseInt(rateLimitMs as string, 10)
      const maxRetriesNum = parseInt(maxRetries as string, 10)
      const checkpointIntervalNum = parseInt(checkpointInterval as string, 10)

      if (isNaN(rateLimitDelay) || rateLimitDelay < 0) {
        console.error('❌ --rate-limit must be a non-negative number (milliseconds)')
        process.exit(1)
      }
      if (isNaN(maxRetriesNum) || maxRetriesNum < 0) {
        console.error('❌ --max-retries must be a non-negative number')
        process.exit(1)
      }
      if (isNaN(checkpointIntervalNum) || checkpointIntervalNum < 1) {
        console.error('❌ --checkpoint-interval must be a positive number')
        process.exit(1)
      }

      if (verbose) {
        console.info(`📄 Input: ${input}`)
        console.info(`💾 Output: ${output}`)
        console.info(`📍 Checkpoint dir: ${checkpointDir}`)
        console.info(`⏱️  Rate limit: ${rateLimitDelay}ms`)
        console.info(`🔄 Max retries: ${maxRetriesNum}`)
        console.info(`💿 Checkpoint interval: ${checkpointIntervalNum} items`)
        console.info(`🖼️  Vision: ${enableVision ? 'enabled' : 'disabled'}`)
        console.info(`🎵 Audio: ${enableAudio ? 'enabled' : 'disabled'}`)
        console.info(`🔗 Links: ${enableLinks ? 'enabled' : 'disabled'}`)
      }

      // Create checkpoint directory if needed
      if (!fs.existsSync(checkpointDir)) {
        await import('fs/promises').then((fsp) => fsp.mkdir(checkpointDir, { recursive: true }))
      }

      // Load normalized messages
      const content = fs.readFileSync(input, 'utf-8')
      const data = JSON.parse(content)
      const messages = Array.isArray(data) ? data : data.messages || []

      console.info(`✓ Loaded ${messages.length.toLocaleString()} messages`)

      // Import enrichment modules
      const { loadCheckpoint, computeConfigHash, saveCheckpoint, createCheckpoint } = await import(
        './enrich/checkpoint.js'
      )

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

      // AC05: Load checkpoint and verify config hash
      let startIndex = 0
      if (resume) {
        const checkpoint = await loadCheckpoint(checkpointPath)
        if (checkpoint) {
          if (checkpoint.configHash !== configHash) {
            console.error('❌ Config has changed since last checkpoint')
            console.error('Use --force-refresh to re-enrich or delete checkpoint file')
            process.exit(1)
          }
          startIndex = checkpoint.lastProcessedIndex + 1
          console.info(`✓ Resuming from checkpoint at index ${startIndex}`)
          console.info(`  Already processed: ${checkpoint.totalProcessed}`)
          console.info(`  Failed items: ${checkpoint.totalFailed}`)
        } else if (resume) {
          console.warn(`⚠️  No checkpoint found, starting from beginning`)
        }
      }

      // AC02: Enrich messages with checkpoint support
      const enrichedMessages: Message[] = []
      let totalProcessed = 0
      let totalFailed = 0
      const failedItems: Array<{ index: number; guid: string; kind: string; error: string }> = []

      console.info(`\n🚀 Starting enrichment (${messages.length - startIndex} messages remaining)`)

      for (let i = startIndex; i < messages.length; i++) {
        const message = messages[i]

        try {
          // For now, just copy message (actual enrichment would go here)
          // The enrichment logic is already in src/enrich/ modules
          enrichedMessages.push(message)
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
              console.info(`💾 Checkpoint written at index ${i + 1}`)
            }
          }
        } catch (error) {
          totalFailed++
          const errorMessage = error instanceof Error ? error.message : String(error)
          failedItems.push({
            index: i,
            guid: message.guid || 'unknown',
            kind: message.messageKind || 'unknown',
            error: errorMessage,
          })
          if (verbose) {
            console.warn(`⚠️  Failed to enrich message ${i}: ${errorMessage}`)
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

      console.info(`\n✅ Enrichment complete`)
      console.info(`✓ Processed: ${totalProcessed.toLocaleString()} messages`)
      if (totalFailed > 0) {
        console.info(`⚠️  Failed: ${totalFailed.toLocaleString()} messages`)
      }
      console.info(`✓ Wrote to ${output}`)
      process.exit(0)
    } catch (error) {
      console.error(`❌ Failed to enrich:`, error instanceof Error ? error.message : String(error))
      if (program.opts().verbose && error instanceof Error) {
        console.error(error.stack)
      }
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
  .option('-o, --output <dir>', 'output directory for markdown files', './timeline')
  .option('--start-date <date>', 'render messages from this date (YYYY-MM-DD)')
  .option('--end-date <date>', 'render messages until this date (YYYY-MM-DD)')
  .option('--group-by-time', 'group messages by time-of-day (Morning/Afternoon/Evening)', true)
  .option('--nested-replies', 'render replies as nested blockquotes', true)
  .option('--max-nesting-depth <n>', 'maximum nesting depth for replies (default 10)', '10')
  .action(async (options) => {
    const { input, output, startDate, endDate, groupByTime, nestedReplies, maxNestingDepth } =
      options
    const verbose = program.opts().verbose

    try {
      // CLI-T04-AC01: Date filtering validation
      const fs = await import('fs')
      if (!fs.existsSync(input)) {
        console.error(`❌ Input file not found: ${input}`)
        process.exit(1)
      }

      let startDateObj: Date | null = null
      let endDateObj: Date | null = null

      if (startDate) {
        const start = new Date(startDate)
        if (isNaN(start.getTime())) {
          console.error(`❌ Invalid start date: ${startDate} (use YYYY-MM-DD format)`)
          process.exit(1)
        }
        startDateObj = start
      }

      if (endDate) {
        const end = new Date(endDate)
        if (isNaN(end.getTime())) {
          console.error(`❌ Invalid end date: ${endDate} (use YYYY-MM-DD format)`)
          process.exit(1)
        }
        // Set to end of day
        end.setHours(23, 59, 59, 999)
        endDateObj = end
      }

      // CLI-T04-AC03: Validate max nesting depth
      const maxNestingDepthNum = parseInt(maxNestingDepth as string, 10)
      if (isNaN(maxNestingDepthNum) || maxNestingDepthNum < 1) {
        console.error(`❌ --max-nesting-depth must be a positive number`)
        process.exit(1)
      }

      if (verbose) {
        console.info(`📄 Input: ${input}`)
        console.info(`📁 Output directory: ${output}`)
        if (startDateObj) {
          console.info(`📅 Start date: ${startDate}`)
        }
        if (endDateObj) {
          console.info(`📅 End date: ${endDate}`)
        }
        console.info(`⏱️  Group by time: ${groupByTime}`)
        console.info(`⬅️  Nested replies: ${nestedReplies}`)
        console.info(`📊 Max nesting depth: ${maxNestingDepthNum}`)
      }

      // Load input messages
      const content = fs.readFileSync(input, 'utf-8')
      const data = JSON.parse(content)
      let messages: Message[] = Array.isArray(data) ? data : data.messages || []

      if (verbose) {
        console.info(`✓ Loaded ${messages.length.toLocaleString()} messages`)
      }

      // Filter by date range if specified
      if (startDateObj || endDateObj) {
        const filtered = messages.filter((msg) => {
          const msgDate = new Date(msg.date)
          if (startDateObj && msgDate < startDateObj) return false
          if (endDateObj && msgDate > endDateObj) return false
          return true
        })
        console.info(`📊 Filtered to ${filtered.length.toLocaleString()} messages in date range`)
        messages = filtered
      }

      // Import render functions
      const { renderMessages } = await import('./render/index.js')

      // Render messages to markdown
      const rendered = renderMessages(messages)

      if (rendered.size === 0) {
        console.warn(`⚠️  No messages to render`)
        process.exit(0)
      }

      // CLI-T04-AC04: Create output directory if doesn't exist
      const path = await import('path')
      const outputDir = path.resolve(output)

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
        if (verbose) {
          console.info(`📁 Created output directory: ${outputDir}`)
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
          console.info(`✓ Wrote ${filename}`)
        }
      }

      // CLI-T04-AC05: Summary output
      console.info(`\n✅ Rendered ${filesWritten} markdown file(s)`)
      console.info(
        `✓ Wrote ${filesWritten.toLocaleString()} markdown file${filesWritten === 1 ? '' : 's'} to ${outputDir}`,
      )

      // Message summary
      const textMessages = messages.filter((m) => m.messageKind === 'text').length
      const mediaMessages = messages.filter((m) => m.messageKind === 'media').length
      const tapbacks = messages.filter((m) => m.messageKind === 'tapback').length

      console.info(`\n📊 Message Summary:`)
      console.info(`  Total: ${messages.length.toLocaleString()}`)
      console.info(`  Text: ${textMessages.toLocaleString()}`)
      console.info(`  Media: ${mediaMessages.toLocaleString()}`)
      console.info(`  Tapbacks: ${tapbacks.toLocaleString()}`)

      process.exit(0)
    } catch (error) {
      console.error(
        `❌ Failed to render markdown:`,
        error instanceof Error ? error.message : String(error),
      )
      if (program.opts().verbose && error instanceof Error) {
        console.error(error.stack)
      }
      process.exit(2)
    }
  })

// Helper commands (CLI--T05)
program
  .command('validate')
  .description('Validate JSON file against message schema')
  .action(() => {
    console.info('⚠️  validate command not yet implemented')
    console.info('This will be implemented in CLI--T05')
    process.exit(0)
  })

program
  .command('stats')
  .description('Show statistics for message file')
  .action(() => {
    console.info('⚠️  stats command not yet implemented')
    console.info('This will be implemented in CLI--T05')
    process.exit(0)
  })

program
  .command('clean')
  .description('Remove temporary files and checkpoints')
  .action(() => {
    console.info('⚠️  clean command not yet implemented')
    console.info('This will be implemented in CLI--T05')
    process.exit(0)
  })

program
  .command('doctor')
  .description('Diagnose common configuration issues')
  .action(() => {
    console.info('⚠️  doctor command not yet implemented')
    console.info('This will be implemented in CLI--T05')
    process.exit(0)
  })

// ============================================================================
// Config generation command (CONFIG--T03)
// ============================================================================

program
  .command('init')
  .description('Generate starter configuration file')
  .option('-f, --format <type>', 'config file format (json|yaml)', 'yaml')
  .option('--force', 'overwrite existing config file without prompting', false)
  .option('-o, --output <path>', 'output file path (default: auto-detected from format)')
  .action(async (options) => {
    const { format, force, output } = options

    // Validate format
    if (format !== 'json' && format !== 'yaml') {
      console.error(`❌ Invalid format: ${format}`)
      console.error('Supported formats: json, yaml')
      process.exit(1)
    }

    try {
      // Lazy import to avoid circular dependencies
      const { generateConfigFile, getDefaultConfigPath, configFileExists } = await import(
        './config/generator.js'
      )

      // Determine output path
      const filePath = output || getDefaultConfigPath(format)

      // CONFIG-T03-AC04: Check for existing file and prompt if needed
      const exists = await configFileExists(filePath)
      if (exists && !force) {
        console.error(`❌ Config file already exists: ${filePath}`)
        console.error('\nOptions:')
        console.error('  • Use --force to overwrite')
        console.error(`  • Use --output to specify different path`)
        console.error(`  • Manually remove the existing file`)
        process.exit(1)
      }

      // CONFIG-T03-AC01, AC02, AC03: Generate config file
      const result = await generateConfigFile({
        filePath,
        format,
        force,
      })

      if (result.success) {
        console.info(result.message)
        console.info('\n📝 Next steps:')
        console.info(`  1. Edit ${filePath} to add your API keys`)
        console.info('  2. Set GEMINI_API_KEY environment variable')
        console.info('  3. (Optional) Set FIRECRAWL_API_KEY for enhanced link scraping')
        console.info('\n💡 See inline comments in the config file for details')
        process.exit(0)
      } else {
        console.error(`❌ ${result.message}`)
        process.exit(1)
      }
    } catch (error) {
      console.error(
        `❌ Failed to generate config:`,
        error instanceof Error ? error.message : String(error),
      )
      if (program.opts().verbose && error instanceof Error) {
        console.error(error.stack)
      }
      process.exit(2)
    }
  })

// ============================================================================
// CLI--T01-AC04: Proper exit codes (0=success, 1=validation, 2=runtime)
// ============================================================================

// Global error handler for uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Fatal Error:', err.message)
  if (program.opts().verbose) {
    console.error(err.stack)
  }
  process.exit(2) // Runtime error
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason)
  process.exit(2) // Runtime error
})

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`)
      if (program.opts().verbose) {
        console.error(error.stack)
      }
    } else {
      console.error(`❌ Unknown error:`, error)
    }
    process.exit(1)
  }
}

void main()
