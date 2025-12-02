import type { ExportEnvelope, Message } from '../schema/message.js'

export type DBMessage = {
	guid: string
	rowid?: number
	text?: string | null
	is_from_me: number
	date: number // Apple epoch in seconds or nanoseconds
	chat_id?: string
	handle?: string
	service?: string
	subject?: string | null
	attachments?: DBAttachment[]
	[key: string]: unknown
}

export type DBAttachment = {
	id: string
	filename: string
	mime_type?: string
	uti?: string | null
	copied_path?: string
	total_bytes?: number
	[key: string]: unknown
}

export type IngestOptions = {
	attachmentRoots: string[]
}

/**
 * Apple epoch reference: seconds since 2001-01-01 00:00:00 UTC
 * Unix epoch reference: seconds since 1970-01-01 00:00:00 UTC
 * Difference: 31 years = 978307200 seconds
 */
const APPLE_EPOCH_OFFSET = 978307200

/**
 * Split a single DB message into multiple Message objects
 * - 1 text message (if text exists)
 * - N media messages (one per attachment)
 * All parts share same groupGuid (original DB guid) and timestamps
 */
export function splitDBMessage(
	dbMessage: DBMessage,
	lineNumber: number,
	_options: IngestOptions,
): Message[] {
	const messages: Message[] = []
	const originalGuid = dbMessage.guid
	const attachments = dbMessage.attachments || []
	const date = convertAppleEpochToISO8601(dbMessage.date)
	const isFromMe = dbMessage.is_from_me === 1

	if (!date) return [] // Skip invalid dates

	// Common fields for all parts
	const baseMessage: Partial<Message> = {
		isFromMe,
		date,
		groupGuid: originalGuid,
	}

	// Conditionally add optional fields to satisfy exactOptionalPropertyTypes
	if (dbMessage.handle) baseMessage.handle = dbMessage.handle
	if (dbMessage.chat_id) baseMessage.chatId = dbMessage.chat_id
	if (dbMessage.service) baseMessage.service = dbMessage.service
	if (dbMessage.subject) baseMessage.subject = dbMessage.subject

	// Part index counter (0 = text, 1+ = media)
	let partIndex = 0

	// 1. Create text message if text exists
	if (dbMessage.text) {
		const textMessage: Message = {
			...baseMessage,
			guid: generatePartGUID(originalGuid, partIndex),
			messageKind: 'text',
			text: dbMessage.text,
			exportMetadata: {
				source: 'db',
				lineNumber,
				parentGUID: originalGuid,
				partIndex,
			},
		} as Message

		messages.push(textMessage)
		partIndex++
	}

	// 2. Create media messages for each attachment
	attachments.forEach((att, attachmentIndex) => {
		const mediaMessage: Message = {
			...baseMessage,
			guid: generatePartGUID(originalGuid, partIndex),
			messageKind: 'media',
			media: {
				id: att.id || `media:${originalGuid}:${attachmentIndex}`,
				filename: att.filename || 'unknown',
				path: att.copied_path || null,
				mimeType: att.mime_type || undefined,
				uti: att.uti || undefined,
				size: att.total_bytes || undefined,
				mediaKind: inferMediaKind(att.mime_type || ''),
			},
			exportMetadata: {
				source: 'db',
				lineNumber,
				parentGUID: originalGuid,
				partIndex,
				attachmentIndex,
			},
		} as Message

		messages.push(mediaMessage)
		partIndex++
	})

	return messages
}

/**
 * Generate stable part GUID using format: p:<index>/<original_guid>
 * This ensures:
 * - Deterministic generation (same input → same output)
 * - Stable ordering (index reflects order in split)
 * - Uniqueness within a message's parts
 */
export function generatePartGUID(originalGuid: string, index: number): string {
	return `p:${index}/${originalGuid}`
}

/**
 * Convert Apple epoch timestamp to ISO 8601 UTC with Z suffix
 * Apple epoch = seconds since 2001-01-01 00:00:00 UTC
 *
 * Handles:
 * - Seconds precision: 718110777
 * - Milliseconds precision: 718110777000
 * - Nanoseconds precision: 718110777123456789 (truncate to seconds)
 */
export function convertAppleEpochToISO8601(appleEpoch: number): string | null {
	try {
		// Determine if input is in seconds, milliseconds, or nanoseconds
		// Apple epoch realistic ranges:
		// - Seconds: 0 to ~5,000,000,000 (2001 to ~2159)
		// - Milliseconds: 0 to ~5,000,000,000,000 (2001 to ~2159)
		// - Nanoseconds: anything > 1e15
		let seconds: number

		if (appleEpoch > 1000000000000000) {
			// Clearly nanoseconds (> 1 quadrillion)
			seconds = Math.floor(appleEpoch / 1000000000)
		} else if (appleEpoch > 100000000000) {
			// Likely milliseconds (> 100 billion, beyond realistic seconds range)
			seconds = Math.floor(appleEpoch / 1000)
		} else {
			// Seconds (includes values up to ~5 billion, covering years 2001-2159)
			seconds = appleEpoch
		}

		// Convert Apple epoch to Unix epoch
		const unixSeconds = seconds + APPLE_EPOCH_OFFSET

		// Create Date and convert to ISO 8601
		const date = new Date(unixSeconds * 1000)
		return date.toISOString()
	} catch {
		return null
	}
}

/**
 * Infer media kind from MIME type
 */
export function inferMediaKind(
	mimeType: string,
): 'image' | 'audio' | 'video' | 'pdf' | 'unknown' {
	if (!mimeType) return 'unknown'

	if (mimeType.startsWith('image/')) return 'image'
	if (mimeType.startsWith('audio/')) return 'audio'
	if (mimeType.startsWith('video/')) return 'video'
	if (mimeType.includes('pdf')) return 'pdf'

	return 'unknown'
}

/**
 * Main entry point: Ingest DB messages and split into normalized schema
 */
export function ingestDBMessages(
	dbMessages: DBMessage[],
	options: IngestOptions,
): Message[] {
	const messages: Message[] = []
	let lineNumber = 1

	for (const dbMsg of dbMessages) {
		const splitMessages = splitDBMessage(dbMsg, lineNumber, options)
		messages.push(...splitMessages)
		lineNumber++
	}

	return messages
}

/**
 * Create export envelope for DB ingestion output
 */
export function createExportEnvelope(messages: Message[]): ExportEnvelope {
	return {
		schemaVersion: '2.0.0',
		source: 'db',
		createdAt: new Date().toISOString(),
		messages,
	}
}
