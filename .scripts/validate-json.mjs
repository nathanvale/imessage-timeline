#!/usr/bin/env node
// .scripts/validate-json.mjs
// CLI validator for iMessage JSON exports against Message schema

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { z } from 'zod'

// ============================================================================
// Inline Zod Schemas (from src/schema/message.ts)
// ============================================================================

const MediaEnrichmentSchema = z.object({
  kind: z.enum(['image', 'audio', 'link', 'video', 'pdf', 'unknown']),
  model: z.string().optional(),
  createdAt: z.string().datetime(),
  visionSummary: z.string().optional(),
  shortDescription: z.string().optional(),
  transcript: z.string().optional(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  provider: z.enum(['gemini', 'firecrawl', 'local']),
  version: z.string(),
}).superRefine((enrichment, ctx) => {
  if (enrichment.createdAt && !enrichment.createdAt.match(/Z$/)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'enrichment.createdAt must be ISO 8601 with Z suffix (UTC)',
    })
  }
})

const MediaMetaSchema = z.object({
  id: z.string(),
  filename: z.string(),
  path: z.string(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  uti: z.string().nullable().optional(),
  isSticker: z.boolean().optional(),
  hidden: z.boolean().optional(),
  mediaKind: z.enum(['image', 'audio', 'video', 'pdf', 'unknown']).optional(),
  enrichment: z.array(MediaEnrichmentSchema).optional(),
}).superRefine((media, ctx) => {
  if (media.path && !media.path.startsWith('/')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'media.path must be an absolute path (starting with /)',
      path: ['path'],
    })
  }
})

const ReplyInfoSchema = z.object({
  sender: z.string().optional(),
  date: z.string().datetime().optional(),
  text: z.string().optional(),
  targetMessageGuid: z.string().optional(),
}).superRefine((reply, ctx) => {
  if (reply.date) {
    if (!reply.date.match(/Z$/)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'replyingTo.date must be ISO 8601 with Z suffix (UTC)',
        path: ['date'],
      })
    }
    if (isNaN(Date.parse(reply.date))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'replyingTo.date must be a valid ISO 8601 date',
        path: ['date'],
      })
    }
  }
})

const TapbackInfoSchema = z.object({
  type: z.enum(['loved', 'liked', 'disliked', 'laughed', 'emphasized', 'questioned', 'emoji']),
  action: z.enum(['added', 'removed']),
  targetMessageGuid: z.string().optional(),
  targetMessagePart: z.number().int().optional(),
  targetText: z.string().optional(),
  isMedia: z.boolean().optional(),
  emoji: z.string().optional(),
})

const MessageSchema = z.object({
  guid: z.string(),
  rowid: z.number().optional(),
  chatId: z.string().nullable().optional(),
  service: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  handleId: z.number().nullable().optional(),
  handle: z.string().nullable().optional(),
  destinationCallerId: z.string().nullable().optional(),
  isFromMe: z.boolean(),
  otherHandle: z.number().nullable().optional(),
  date: z.string().datetime(),
  dateRead: z.string().datetime().nullable().optional(),
  dateDelivered: z.string().datetime().nullable().optional(),
  dateEdited: z.string().datetime().nullable().optional(),
  isRead: z.boolean().optional(),
  itemType: z.number().optional(),
  groupActionType: z.number().optional(),
  groupTitle: z.string().nullable().optional(),
  shareStatus: z.boolean().optional(),
  shareDirection: z.boolean().nullable().optional(),
  expressiveSendStyleId: z.string().nullable().optional(),
  balloonBundleId: z.string().nullable().optional(),
  threadOriginatorGuid: z.string().nullable().optional(),
  threadOriginatorPart: z.number().nullable().optional(),
  numReplies: z.number().optional(),
  deletedFrom: z.number().nullable().optional(),
  messageKind: z.enum(['text', 'media', 'tapback', 'notification']),
  text: z.string().nullable().optional(),
  tapback: TapbackInfoSchema.nullable().optional(),
  replyingTo: ReplyInfoSchema.nullable().optional(),
  replyingToRaw: z.string().nullable().optional(),
  media: MediaMetaSchema.nullable().optional(),
  groupGuid: z.string().nullable().optional(),
  exportTimestamp: z.string().datetime().optional(),
  exportVersion: z.string().optional(),
  isUnsent: z.boolean().optional(),
  isEdited: z.boolean().optional(),
}).superRefine((msg, ctx) => {
  const dateFields = ['date', 'dateRead', 'dateDelivered', 'dateEdited', 'exportTimestamp']

  for (const field of dateFields) {
    const value = msg[field]
    if (value && typeof value === 'string') {
      if (!value.match(/Z$/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be ISO 8601 with Z suffix (UTC)`,
          path: [field],
        })
      }
    }
  }

  if (msg.messageKind === 'tapback' && !msg.tapback) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'tapback kind requires tapback payload',
      path: ['tapback'],
    })
  }

  if (msg.messageKind === 'media' && !msg.media) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'media kind requires media payload',
      path: ['media'],
    })
  }

  if (msg.messageKind !== 'media' && msg.media) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'media payload present on non-media message',
      path: ['media'],
    })
  }

  if (msg.messageKind === 'media' && msg.media) {
    if (!msg.media.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'media.id is required when messageKind is media',
        path: ['media', 'id'],
      })
    }
    if (!msg.media.filename) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'media.filename is required when messageKind is media',
        path: ['media', 'filename'],
      })
    }
    if (!msg.media.path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'media.path is required when messageKind is media',
        path: ['media', 'path'],
      })
    }
  }
})

const ExportEnvelopeSchema = z.object({
  schemaVersion: z.string(),
  source: z.enum(['csv', 'db', 'merged']),
  createdAt: z.string().datetime(),
  messages: z.array(MessageSchema),
  meta: z.record(z.any()).optional(),
}).superRefine((envelope, ctx) => {
  if (envelope.createdAt && !envelope.createdAt.match(/Z$/)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'createdAt must be ISO 8601 with Z suffix (UTC)',
      path: ['createdAt'],
    })
  }
})

// ============================================================================
// Validation Logic
// ============================================================================

function formatZodErrors(error, filePath) {
  const output = []

  output.push(`\n❌ Validation failed for: ${filePath}\n`)

  let errors = []
  try {
    errors = JSON.parse(error.message)
  } catch (parseError) {
    output.push(`Error: ${error.message}\n`)
    return output.join('\n')
  }

  if (!Array.isArray(errors)) {
    output.push(`Error: ${error.message}\n`)
    return output.join('\n')
  }

  errors.forEach((err, index) => {
    const fieldPath = err.path && err.path.length > 0 ? err.path.join('.') : '<root>'
    const message = err.message || 'Unknown validation error'

    output.push(`${index + 1}. Field: ${fieldPath}`)
    output.push(`   Error: ${message}`)
    if (err.code) {
      output.push(`   Code: ${err.code}`)
    }
    output.push('')
  })

  output.push(`\n❌ ${errors.length} validation error${errors.length > 1 ? 's' : ''} found\n`)

  return output.join('\n')
}

function calculateStats(messages) {
  const stats = {
    total: messages.length,
    byKind: {
      text: 0,
      media: 0,
      tapback: 0,
      notification: 0,
    },
    withErrors: 0,
    withMedia: 0,
    withReplies: 0,
    withTapbacks: 0,
  }

  messages.forEach(msg => {
    if (msg.messageKind && stats.byKind.hasOwnProperty(msg.messageKind)) {
      stats.byKind[msg.messageKind]++
    }
    if (msg.media) stats.withMedia++
    if (msg.replyingTo) stats.withReplies++
    if (msg.tapback) stats.withTapbacks++
  })

  return stats
}

function displayStats(stats, source) {
  console.log('\n✅ Valid schema!\n')
  console.log('📊 Summary:')
  console.log(`  Source: ${source || 'unknown'}`)
  console.log(`  Total messages: ${stats.total.toLocaleString()}`)
  console.log('\n  By message kind:')
  console.log(`    - text: ${stats.byKind.text.toLocaleString()}`)
  console.log(`    - media: ${stats.byKind.media.toLocaleString()}`)
  console.log(`    - tapback: ${stats.byKind.tapback.toLocaleString()}`)
  console.log(`    - notification: ${stats.byKind.notification.toLocaleString()}`)

  if (stats.withReplies > 0) {
    console.log(`\n  With replies: ${stats.withReplies.toLocaleString()}`)
  }
  if (stats.withTapbacks > 0) {
    console.log(`  With tapbacks: ${stats.withTapbacks.toLocaleString()}`)
  }
  if (stats.withMedia > 0) {
    console.log(`  With media attachments: ${stats.withMedia.toLocaleString()}`)
  }

  console.log('')
}

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.error('❌ Error: Missing file path argument\n')
    console.error('Usage: node .scripts/validate-json.mjs <file-path>')
    console.error('Example: node .scripts/validate-json.mjs ./exports/messages.json\n')
    process.exit(2)
  }

  const absolutePath = resolve(filePath)

  try {
    const content = readFileSync(absolutePath, 'utf-8')

    let data
    try {
      data = JSON.parse(content)
    } catch (parseError) {
      console.error(`❌ Invalid JSON in file: ${absolutePath}`)
      console.error(`Parse error: ${parseError.message}\n`)
      process.exit(2)
    }

    let messages
    let source = 'unknown'
    let validationError = null

    if (data && typeof data === 'object' && !Array.isArray(data) && 'messages' in data) {
      // ExportEnvelope
      try {
        const envelope = ExportEnvelopeSchema.parse(data)
        messages = envelope.messages
        source = envelope.source
      } catch (error) {
        validationError = error
      }
    } else if (Array.isArray(data)) {
      // Array of messages
      try {
        messages = []
        for (const msg of data) {
          messages.push(MessageSchema.parse(msg))
        }
        source = 'array'
      } catch (error) {
        validationError = error
      }
    } else {
      validationError = new Error('Data is neither an ExportEnvelope nor an array of messages')
    }

    if (validationError) {
      console.error(formatZodErrors(validationError, absolutePath))
      console.error('💡 Tip: If this is a plain array of messages, ensure each message conforms to MessageSchema.')
      console.error('    If this is an ExportEnvelope, ensure it has: schemaVersion, source, createdAt, messages\n')
      process.exit(1)
    }

    const stats = calculateStats(messages)
    displayStats(stats, source)

    process.exit(0)

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ File not found: ${absolutePath}\n`)
      process.exit(2)
    } else if (error.code === 'EACCES') {
      console.error(`❌ Permission denied: ${absolutePath}\n`)
      process.exit(2)
    } else {
      console.error(`❌ Unexpected error: ${error.message}`)
      console.error(error.stack)
      process.exit(2)
    }
  }
}

main()
