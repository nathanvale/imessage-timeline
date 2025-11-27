/**
 * Reply and Tapback Rendering Module (RENDER--T02)
 *
 * Implements nested reply and tapback rendering:
 * - AC01: Render replies as nested blockquotes (> prefix)
 * - AC02: Render tapbacks as emoji reactions with mapping
 * - AC03: Handle multi-level nesting (reply to reply)
 * - AC04: Indent levels match conversation depth (2 spaces per level)
 * - AC05: Preserve sender attribution in nested content
 */

import type { Message } from '#schema/message'

/**
 * Reply context for rendering
 */
export type ReplyContext = {
	message: Message
	parentGuid: string
	depth: number
	children?: ReplyContext[]
}

/**
 * Tapback context for rendering
 */
export type TapbackContext = {
	message: Message
	parentGuid: string
	type: string
}

/**
 * Tapback type to emoji mapping per spec
 */
const TAPBACK_EMOJI_MAP: Record<string, string> = {
	liked: '❤️',
	loved: '😍',
	laughed: '😂',
	emphasized: '‼️',
	questioned: '❓',
	disliked: '👎',
}

/**
 * AC02: Map tapback type to emoji
 */
export function getTapbackEmoji(tapbackType: string): string {
	return TAPBACK_EMOJI_MAP[tapbackType] || '👍' // Default to thumbs up
}

/**
 * AC01: Find all replies to a specific message
 */
export function findRepliesForMessage(
	parentGuid: string,
	messages: Message[],
): Message[] {
	return messages.filter(
		(msg) => msg.replyingTo?.targetMessageGuid === parentGuid,
	)
}

/**
 * AC02: Find all tapbacks for a specific message
 */
export function findTapbacksForMessage(
	parentGuid: string,
	messages: Message[],
): Message[] {
	return messages.filter(
		(msg) =>
			msg.messageKind === 'tapback' &&
			msg.tapback?.targetMessageGuid === parentGuid,
	)
}

/**
 * AC04: Calculate indentation level (how deep in the reply chain)
 */
export function calculateIndentationLevel(
	messageGuid: string,
	messages: Message[],
): number {
	const messageMap = new Map(messages.map((m) => [m.guid, m]))
	const message = messageMap.get(messageGuid)

	if (!message || !message.replyingTo) {
		return 0
	}

	let level = 1
	let currentGuid = message.replyingTo?.targetMessageGuid
	const visited = new Set<string>([messageGuid]) // Prevent infinite loops

	while (currentGuid && !visited.has(currentGuid)) {
		const parent = messageMap.get(currentGuid)
		if (!parent || !parent.replyingTo?.targetMessageGuid) {
			break
		}

		visited.add(currentGuid)
		currentGuid = parent.replyingTo.targetMessageGuid
		level++
	}

	return level
}

/**
 * AC04: Format reply with proper indentation (2 spaces per level)
 * Returns prefix for blockquote (>, > >, > > >, etc.)
 */
export function formatReplyWithIndentation(
	message: Message,
	level: number,
): string {
	const indent = ' '.repeat(level * 2)
	const blockquotePrefix = '>'.repeat(level + 1)
	return `${indent}${blockquotePrefix}`
}

/**
 * AC01, AC05: Render reply as nested blockquote with sender attribution
 */
export function renderReplyAsBlockquote(
	message: Message,
	level: number,
): string {
	if (message.messageKind !== 'text' && !message.text) {
		return ''
	}

	const indent = ' '.repeat(level * 2)
	const blockquotePrefix = '>'.repeat(level + 1)

	// Build sender attribution
	let senderLine = ''
	if (message.handle) {
		senderLine = `${indent}${blockquotePrefix} **${message.handle}**: `
	} else {
		senderLine = `${indent}${blockquotePrefix} `
	}

	// Add message text with proper line continuation
	const textLines = (message.text || '').split('\n')
	const firstLine = `${senderLine}${textLines[0]}`

	if (textLines.length === 1) {
		return firstLine
	}

	// Additional lines get full blockquote prefix
	const additionalLines = textLines
		.slice(1)
		.map((line) => `${indent}${blockquotePrefix} ${line}`)

	return [firstLine, ...additionalLines].join('\n')
}

/**
 * AC02: Render tapback as emoji
 */
export function renderTapbackAsEmoji(message: Message): string {
	if (message.messageKind !== 'tapback' || !message.tapback) {
		return ''
	}

	return getTapbackEmoji(message.tapback.type)
}

/**
 * AC03: Build reply tree structure for a message
 */
export type ReplyTree = {
	message: Message
	guid: string
	children: ReplyTree[]
}

export function buildReplyTree(
	parentGuid: string,
	messages: Message[],
): ReplyTree | null {
	const messageMap = new Map(messages.map((m) => [m.guid, m]))
	const message = messageMap.get(parentGuid)

	if (!message) {
		return null
	}

	const children: ReplyTree[] = []
	const directReplies = findRepliesForMessage(parentGuid, messages)

	for (const reply of directReplies) {
		const child = buildReplyTree(reply.guid, messages)
		if (child) {
			children.push(child)
		}
	}

	return {
		message,
		guid: parentGuid,
		children,
	}
}

/**
 * Group tapbacks by type
 */
export function getTapbacksGrouped(
	parentGuid: string,
	messages: Message[],
): Record<string, Message[]> {
	const tapbacks = findTapbacksForMessage(parentGuid, messages)
	const grouped: Record<string, Message[]> = {}

	for (const tapback of tapbacks) {
		const type = tapback.tapback?.type || 'unknown'
		if (!grouped[type]) {
			grouped[type] = []
		}
		grouped[type].push(tapback)
	}

	return grouped
}

/**
 * Get all reply depths for traversal
 */
export function getReplyChain(
	messageGuid: string,
	messages: Message[],
): Message[] {
	const messageMap = new Map(messages.map((m) => [m.guid, m]))
	const chain: Message[] = []
	let currentGuid: string | undefined = messageGuid
	const visited = new Set<string>()

	while (currentGuid && !visited.has(currentGuid)) {
		const msg = messageMap.get(currentGuid)
		if (!msg) break

		chain.unshift(msg) // Add to beginning
		visited.add(currentGuid)
		currentGuid = msg.replyingTo?.targetMessageGuid
	}

	return chain
}

/**
 * Format complete reply thread for rendering
 */
export type FormattedReplyThread = {
	parentMessage: Message
	replies: Array<{
		message: Message
		level: number
		formatted: string
	}>
	tapbacks: string[]
}

export function formatReplyThread(
	parentGuid: string,
	messages: Message[],
): FormattedReplyThread | null {
	const messageMap = new Map(messages.map((m) => [m.guid, m]))
	const parentMessage = messageMap.get(parentGuid)

	if (!parentMessage) {
		return null
	}

	// Collect all direct replies and their nested replies
	const replies: Array<{
		message: Message
		level: number
		formatted: string
	}> = []

	const collectReplies = (parent: string, baseLevel: number) => {
		const directReplies = findRepliesForMessage(parent, messages)

		for (const reply of directReplies) {
			const level = baseLevel + 1
			const formatted = renderReplyAsBlockquote(reply, level)

			replies.push({
				message: reply,
				level,
				formatted,
			})

			// Recursively collect nested replies
			collectReplies(reply.guid, level)
		}
	}

	collectReplies(parentGuid, 0)

	// Get tapbacks
	const tapbackMessages = findTapbacksForMessage(parentGuid, messages)
	const tapbacks = tapbackMessages.map((t) => renderTapbackAsEmoji(t))

	return {
		parentMessage,
		replies,
		tapbacks,
	}
}
