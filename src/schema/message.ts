// src/schema/message.ts
import { z } from 'zod'

// ============================================================================
// Type Aliases
// ============================================================================

export type MessageGUID = string
export type ChatId = string

// ============================================================================
// Media Types
// ============================================================================

export type MediaKind = 'image' | 'audio' | 'video' | 'pdf' | 'unknown'

export type MediaEnrichment = {
	kind:
		| MediaKind
		| 'link'
		| 'transcription'
		| 'pdf_summary'
		| 'video_metadata'
		| 'link_context'
		| 'image_analysis'
	model?: string
	createdAt: string
	// image
	visionSummary?: string
	shortDescription?: string
	// audio/transcription
	transcription?: string
	transcript?: string // deprecated, use transcription
	speakers?: string[]
	timestamps?: Array<{ time: string; speaker: string; content: string }>
	// pdf/video
	pdfSummary?: string
	videoMetadata?: {
		filename?: string
		size?: number
		duration?: number
		analyzed?: boolean
		note?: string
	}
	error?: string
	usedFallback?: boolean
	failedProviders?: string[]
	// link/link_context
	url?: string
	title?: string
	summary?: string
	// provenance
	provider:
		| 'gemini'
		| 'firecrawl'
		| 'local'
		| 'youtube'
		| 'spotify'
		| 'twitter'
		| 'instagram'
		| 'generic'
	version: string
}

export type MediaProvenance = {
	source: 'csv' | 'db' | 'merged'
	lastSeen: string // ISO 8601 timestamp
	resolvedAt: string // ISO 8601 timestamp when path validation occurred
}

export type MediaMeta = {
	// Represents the single media item carried by a media message
	id: string
	filename: string
	path: string
	size?: number
	mimeType?: string
	uti?: string | null
	isSticker?: boolean
	hidden?: boolean
	mediaKind?: MediaKind
	enrichment?: Array<MediaEnrichment>
	provenance?: MediaProvenance
}

// ============================================================================
// Reply and Tapback Types
// ============================================================================

export type ReplyInfo = {
	sender?: string
	date?: string // ISO 8601
	text?: string
	targetMessageGuid?: MessageGUID
}

export type TapbackInfo = {
	type:
		| 'loved'
		| 'liked'
		| 'disliked'
		| 'laughed'
		| 'emphasized'
		| 'questioned'
		| 'emoji'
	action: 'added' | 'removed'
	targetMessageGuid?: MessageGUID
	targetMessagePart?: number
	targetText?: string
	isMedia?: boolean
	emoji?: string
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageCore = {
	guid: MessageGUID
	rowid?: number
	chatId?: ChatId | null
	service?: string | null
	subject?: string | null
	handleId?: number | null
	handle?: string | null
	destinationCallerId?: string | null
	isFromMe: boolean
	otherHandle?: number | null
	date: string // ISO 8601
	dateRead?: string | null
	dateDelivered?: string | null
	dateEdited?: string | null
	isRead?: boolean
	itemType?: number
	groupActionType?: number
	groupTitle?: string | null
	shareStatus?: boolean
	shareDirection?: boolean | null
	expressiveSendStyleId?: string | null
	balloonBundleId?: string | null
	threadOriginatorGuid?: string | null
	threadOriginatorPart?: number | null
	numReplies?: number
	deletedFrom?: number | null
}

export type Message = {
	messageKind: 'text' | 'media' | 'tapback' | 'notification'
	text?: string | null
	tapback?: TapbackInfo | null
	replyingTo?: ReplyInfo | null
	replyingToRaw?: string | null
	// Media is modeled as a message; when messageKind = 'media', this is required
	media?: MediaMeta | null
	groupGuid?: string | null
	exportTimestamp?: string
	exportVersion?: string
	isUnsent?: boolean
	isEdited?: boolean
} & MessageCore

// ============================================================================
// Export Envelope
// ============================================================================

export type ExportEnvelope = {
	schemaVersion: string
	source: 'csv' | 'db' | 'merged'
	createdAt: string
	messages: Array<Message>
	meta?: Record<string, unknown>
}

// ============================================================================
// Zod Schemas
// ============================================================================

// Media Enrichment Schema
export const MediaEnrichmentSchema: z.ZodType<MediaEnrichment> = z
	.object({
		kind: z.enum([
			'image',
			'audio',
			'link',
			'video',
			'pdf',
			'unknown',
			'transcription',
			'pdf_summary',
			'video_metadata',
			'link_context',
			'image_analysis',
		]),
		model: z.string().optional(),
		createdAt: z.string().datetime(),
		visionSummary: z.string().optional(),
		shortDescription: z.string().optional(),
		transcription: z.string().optional(),
		transcript: z.string().optional(),
		speakers: z.array(z.string()).optional(),
		timestamps: z
			.array(
				z.object({
					time: z.string(),
					speaker: z.string(),
					content: z.string(),
				}),
			)
			.optional(),
		pdfSummary: z.string().optional(),
		videoMetadata: z
			.object({
				filename: z.string().optional(),
				size: z.number().optional(),
				duration: z.number().optional(),
				analyzed: z.boolean().optional(),
				note: z.string().optional(),
			})
			.optional(),
		error: z.string().optional(),
		usedFallback: z.boolean().optional(),
		failedProviders: z.array(z.string()).optional(),
		url: z.string().url().optional(),
		title: z.string().optional(),
		summary: z.string().optional(),
		provider: z.enum([
			'gemini',
			'firecrawl',
			'local',
			'youtube',
			'spotify',
			'twitter',
			'instagram',
			'generic',
		]),
		version: z.string(),
	})
	.superRefine((enrichment, ctx) => {
		// Ensure enrichment.createdAt has Z suffix (UTC)
		// Note: Zod's datetime() already validates format, this adds additional check
		if (enrichment.createdAt && !enrichment.createdAt.match(/Z$/)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'enrichment.createdAt must be ISO 8601 with Z suffix (UTC)',
			})
		}
	})

// Media Provenance Schema
export const MediaProvenanceSchema: z.ZodType<MediaProvenance> = z
	.object({
		source: z.enum(['csv', 'db', 'merged']),
		lastSeen: z.string().datetime(),
		resolvedAt: z.string().datetime(),
	})
	.superRefine((prov, ctx) => {
		// Ensure all provenance timestamps have Z suffix (UTC)
		if (prov.lastSeen && !prov.lastSeen.match(/Z$/)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'lastSeen must be ISO 8601 with Z suffix (UTC)',
				path: ['lastSeen'],
			})
		}
		if (prov.resolvedAt && !prov.resolvedAt.match(/Z$/)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'resolvedAt must be ISO 8601 with Z suffix (UTC)',
				path: ['resolvedAt'],
			})
		}
	})

// Media Meta Schema
export const MediaMetaSchema: z.ZodType<MediaMeta> = z
	.object({
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
		provenance: MediaProvenanceSchema.optional(),
	})
	.superRefine((media, ctx) => {
		// SCHEMA-T01-AC06: Absolute path validation when file exists
		if (media.path && !media.path.startsWith('/')) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'media.path must be an absolute path (starting with /)',
				path: ['path'],
			})
		}
	})

// Reply Info Schema
export const ReplyInfoSchema: z.ZodType<ReplyInfo> = z
	.object({
		sender: z.string().optional(),
		date: z.string().datetime().optional(),
		text: z.string().optional(),
		targetMessageGuid: z.string().optional(),
	})
	.superRefine((reply, ctx) => {
		// SCHEMA-T01-AC05: ISO 8601 date validation with Z suffix enforced
		if (reply.date) {
			if (!reply.date.match(/Z$/)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'replyingTo.date must be ISO 8601 with Z suffix (UTC)',
					path: ['date'],
				})
			}
			if (Number.isNaN(Date.parse(reply.date))) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'replyingTo.date must be a valid ISO 8601 date',
					path: ['date'],
				})
			}
		}
	})

// Tapback Info Schema
export const TapbackInfoSchema: z.ZodType<TapbackInfo> = z.object({
	type: z.enum([
		'loved',
		'liked',
		'disliked',
		'laughed',
		'emphasized',
		'questioned',
		'emoji',
	]),
	action: z.enum(['added', 'removed']),
	targetMessageGuid: z.string().optional(),
	targetMessagePart: z.number().int().optional(),
	targetText: z.string().optional(),
	isMedia: z.boolean().optional(),
	emoji: z.string().optional(),
})

// Message Core Schema (without refinements to allow extending)
export const MessageCoreSchema: z.ZodType<MessageCore> = z.object({
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
})

// Message Schema with discriminated union and cross-field invariants
export const MessageSchema: z.ZodType<Message> = z
	.object({
		// Core fields from MessageCoreSchema
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
		// Message-specific fields
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
	})
	.superRefine((msg, ctx) => {
		// SCHEMA-T01-AC02: Cross-field invariants using superRefine

		// SCHEMA-T01-AC05: ISO 8601 date validation with Z suffix enforced for all date fields
		const dateFields: Array<keyof typeof msg> = [
			'date',
			'dateRead',
			'dateDelivered',
			'dateEdited',
			'exportTimestamp',
		]

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

		// SCHEMA-T01-AC04: Tapback payload validation (exists when messageKind='tapback')
		if (msg.messageKind === 'tapback' && !msg.tapback) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'tapback kind requires tapback payload',
				path: ['tapback'],
			})
		}

		// SCHEMA-T01-AC03: Media payload validation (exists and complete when messageKind='media')
		if (msg.messageKind === 'media' && !msg.media) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'media kind requires media payload',
				path: ['media'],
			})
		}

		// Non-media messages must NOT carry media payload
		if (msg.messageKind !== 'media' && msg.media) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'media payload present on non-media message',
				path: ['media'],
			})
		}

		// Additional validation: if media payload exists and is complete
		if (msg.messageKind === 'media' && msg.media) {
			// Ensure media has required fields
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

// Export Envelope Schema
export const ExportEnvelopeSchema: z.ZodType<ExportEnvelope> = z
	.object({
		schemaVersion: z.string(),
		source: z.enum(['csv', 'db', 'merged']),
		createdAt: z.string().datetime(),
		messages: z.array(MessageSchema),
		meta: z.record(z.any()).optional(),
	})
	.superRefine((envelope, ctx) => {
		// SCHEMA-T01-AC05: ISO 8601 validation for createdAt
		if (envelope.createdAt && !envelope.createdAt.match(/Z$/)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'createdAt must be ISO 8601 with Z suffix (UTC)',
				path: ['createdAt'],
			})
		}
	})
