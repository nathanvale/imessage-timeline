import { readFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { Message, ExportEnvelope, MessageSchema, ExportEnvelopeSchema } from '../schema/message'
import * as path from 'path'
import * as os from 'os'

export interface IngestOptions {
  attachmentRoots: string[]
  messageDate?: string
}

export interface CSVRow {
  [key: string]: string | undefined
}

/**
 * Main entry point: Ingest CSV file and convert to unified Message schema
 */
export function ingestCSV(csvFilePath: string, options: IngestOptions): Message[] {
  const csvContent = readFileSync(csvFilePath, 'utf-8')
  const rows = parse(csvContent, { columns: true }) as CSVRow[]

  const messages: Message[] = []
  let lineNumber = 2 // Start at 2 (header is line 1)

  for (const row of rows) {
    const rowMessages = parseCSVRow(row, lineNumber, options)
    messages.push(...rowMessages)
    lineNumber++
  }

  return messages
}

/**
 * Parse a single CSV row and produce 1-N messages
 * Maps iMazing CSV format to unified Message schema
 *
 * AC01: Parse iMazing CSV rows with correct field mapping per CSV header
 */
export function parseCSVRow(row: CSVRow, lineNumber: number, options: IngestOptions): Message[] {
  const messages: Message[] = []

  // Extract iMazing CSV fields (headers have spaces, not underscores)
  const messageDate = row['Message Date']
  const deliveredDate = row['Delivered Date']
  const readDate = row['Read Date']
  const editedDate = row['Edited Date']
  const service = row['Service']
  const type = row['Type']
  const senderName = row['Sender Name']
  const senderID = row['Sender ID']
  const status = row['Status']
  const text = row['Text']
  const subject = row['Subject']
  const attachment = row['Attachment']
  const attachmentType = row['Attachment type']
  const replyingTo = row['Replying to']

  // AC03: Convert CSV dates to ISO 8601 UTC with Z suffix
  const date = convertToISO8601(messageDate || '')
  if (!date) return [] // Skip rows with invalid dates

  // AC02: Split rows into text/media/tapback/notification by analyzing content
  // Determine messageKind and isFromMe from Type field
  const isFromMe = type === 'Outgoing' || type === 'Sent'
  let messageKind: 'text' | 'media' | 'tapback' | 'notification' = 'text'

  if (type === 'Notification') {
    messageKind = 'notification'
  }

  // Base message object with common fields
  const baseMessage: Partial<Message> = {
    isFromMe,
    date,
    handle: senderName || senderID || undefined,
    service: service || undefined,
    subject: subject || undefined,
    dateRead: readDate ? convertToISO8601(readDate) : undefined,
    dateDelivered: deliveredDate ? convertToISO8601(deliveredDate) : undefined,
    dateEdited: editedDate ? convertToISO8601(editedDate) : undefined,
    isRead: status === 'Read' ? true : status === 'Unread' ? false : undefined,
    isEdited: editedDate ? true : undefined,
  }

  // AC05: Preserve row metadata (source, line number) for provenance
  const baseExportMetadata = {
    source: 'csv' as const,
    lineNumber,
    csvGuid: `csv:${lineNumber}:0`,
    ...(replyingTo && { replyingTo }),
  }

  // Create text message
  if (messageKind === 'text' && text) {
    const textMessage: Message = {
      ...baseMessage,
      guid: `csv:${lineNumber}:0`,
      messageKind: 'text',
      text,
      exportMetadata: baseExportMetadata,
    } as Message

    messages.push(textMessage)
  }

  // AC04: Resolve iMazing attachment paths to absolute paths when files exist
  if (attachment && attachment.trim() !== '') {
    const resolvedPath = resolveAttachmentPath(
      { filename: attachment },
      {
        ...options,
        messageDate: date,
      }
    )

    // Only create media message if path can be resolved to absolute path (schema requirement)
    if (resolvedPath) {
      const mediaMessage: Message = {
        ...baseMessage,
        guid: `csv:${lineNumber}:0:media`,
        messageKind: 'media',
        media: {
          id: `media:csv:${lineNumber}:0`,
          filename: attachment,
          path: resolvedPath,
          mimeType: attachmentType || undefined,
          mediaKind: inferMediaKind(attachmentType || ''),
        },
        exportMetadata: {
          ...baseExportMetadata,
          attachmentIndex: 0,
        },
      } as Message

      messages.push(mediaMessage)
    }
  }

  // Create notification message if explicitly marked
  if (messageKind === 'notification') {
    const notificationMessage: Message = {
      ...baseMessage,
      guid: `csv:${lineNumber}:0`,
      messageKind: 'notification',
      exportMetadata: baseExportMetadata,
    } as Message

    messages.push(notificationMessage)
  }

  // Fallback: If no messages created but we have text, create text message
  if (messages.length === 0 && text) {
    const fallbackMessage: Message = {
      ...baseMessage,
      guid: `csv:${lineNumber}:0`,
      messageKind: 'text',
      text,
      exportMetadata: baseExportMetadata,
    } as Message

    messages.push(fallbackMessage)
  }

  return messages
}

/**
 * Convert CSV date to ISO 8601 UTC with Z suffix
 * Input format: "YYYY-MM-DD HH:MM:SS" (space-separated)
 */
export function convertToISO8601(csvDate: string): string | null {
  if (!csvDate || csvDate.trim() === '') {
    return null
  }

  try {
    // Normalize: convert space to T (CSV uses space, ISO 8601 uses T)
    const normalized = csvDate.trim().replace(' ', 'T')

    // Basic validation: should contain date separators
    if (!normalized.includes('-') && !normalized.includes('/')) {
      return null
    }

    // Append Z if not present (assuming UTC)
    let isoString = normalized
    if (!normalized.includes('Z') && !normalized.match(/[+-]\d{2}:/)) {
      isoString = normalized + 'Z'
    }

    // Parse and validate
    const date = new Date(isoString)
    if (isNaN(date.getTime())) {
      return null
    }

    // Return ISO 8601 with Z suffix
    return date.toISOString()
  } catch {
    return null
  }
}

/**
 * Resolve attachment path to absolute path when file exists
 */
export function resolveAttachmentPath(
  attachment: any,
  options: IngestOptions & { messageDate?: string }
): string | null {
  if (!attachment) return null

  const { attachmentRoots, messageDate } = options

  // If already absolute and exists, return it
  if (attachment.copied_path && attachment.copied_path.startsWith('/')) {
    if (existsSync(attachment.copied_path)) {
      return attachment.copied_path
    }
  }

  // Expand tilde if present
  if (attachment.copied_path?.startsWith('~')) {
    const expanded = attachment.copied_path.replace('~', os.homedir())
    if (existsSync(expanded)) {
      return expanded
    }
  }

  // Search using timestamp pattern in attachment roots
  if (messageDate && attachmentRoots.length > 0) {
    const dateStr = formatDateForAttachmentSearch(messageDate)
    const filename = attachment.filename || 'unknown'
    const senderName = attachment.senderName || '*'

    for (const root of attachmentRoots) {
      // Try exact pattern: YYYY-MM-DD HH MM SS - SenderName - filename
      const pattern = `${dateStr} - ${senderName} - ${filename}`
      const fullPath = path.join(root, pattern)

      if (existsSync(fullPath)) {
        return fullPath
      }

      // Try wildcard pattern if sender name unknown
      if (senderName === '*' && existsSync(root)) {
        try {
          const files = require('fs').readdirSync(root).filter((f: string) => {
            return f.includes(dateStr) && f.endsWith(filename)
          })

          if (files.length > 0) {
            return path.join(root, files[0])
          }
        } catch {
          // Directory doesn't exist or can't be read
        }
      }
    }
  }

  // Not found
  return null
}

/**
 * Infer media kind from MIME type
 */
export function inferMediaKind(mimeType: string): 'image' | 'audio' | 'video' | 'pdf' | 'unknown' {
  if (!mimeType) return 'unknown'

  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.includes('pdf')) return 'pdf'

  return 'unknown'
}

/**
 * Format ISO 8601 date for attachment search pattern
 * Converts: 2023-10-23T06:52:57.000Z → 2023-10-23 06 52 57
 */
export function formatDateForAttachmentSearch(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours} ${minutes} ${seconds}`
  } catch {
    return ''
  }
}

/**
 * Export envelope wrapper for CSV ingestion output
 */
export function createExportEnvelope(messages: Message[]): ExportEnvelope {
  return {
    schemaVersion: '2.0.0',
    source: 'csv',
    createdAt: new Date().toISOString(),
    messages,
  }
}

/**
 * Validate all messages pass schema validation
 */
export function validateMessages(messages: Message[]): { valid: boolean; errors: any[] } {
  const errors: any[] = []

  for (let i = 0; i < messages.length; i++) {
    const result = MessageSchema.safeParse(messages[i])
    if (!result.success) {
      errors.push({
        index: i,
        message: messages[i],
        issues: result.error.issues,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
