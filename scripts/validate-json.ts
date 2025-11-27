#!/usr/bin/env node
// scripts/validate-json.ts
// CLI validator for iMessage JSON exports against Message schema
/* eslint-disable no-console */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ExportEnvelopeSchema, MessageSchema } from '../src/schema/message'

import type { ZodError } from 'zod'
import type { ExportEnvelope, Message } from '../src/schema/message'

// ============================================================================
// Type Definitions
// ============================================================================

type MessageKind = 'text' | 'media' | 'tapback' | 'notification'

type Stats = {
	total: number
	byKind: Record<MessageKind, number>
	withErrors: number
	withMedia: number
	withReplies: number
	withTapbacks: number
}

type ZodErrorIssue = {
	path?: (string | number)[]
	message?: string
	code?: string
}

// ============================================================================
// Validation Logic
// ============================================================================

function formatZodErrors(error: ZodError, filePath: string): string {
	const output: string[] = []

	output.push(`\n❌ Validation failed for: ${filePath}\n`)

	const errors = error.errors as ZodErrorIssue[]

	if (!Array.isArray(errors)) {
		output.push(`Error: ${error.message}\n`)
		return output.join('\n')
	}

	errors.forEach((err, index) => {
		const fieldPath =
			err.path && err.path.length > 0 ? err.path.join('.') : '<root>'
		const message = err.message || 'Unknown validation error'

		output.push(`${index + 1}. Field: ${fieldPath}`)
		output.push(`   Error: ${message}`)
		if (err.code) {
			output.push(`   Code: ${err.code}`)
		}
		output.push('')
	})

	output.push(
		`\n❌ ${errors.length} validation error${errors.length > 1 ? 's' : ''} found\n`,
	)

	return output.join('\n')
}

function calculateStats(messages: Message[]): Stats {
	const stats: Stats = {
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

	messages.forEach((msg) => {
		if (msg.messageKind && msg.messageKind in stats.byKind) {
			stats.byKind[msg.messageKind]++
		}
		if (msg.media) stats.withMedia++
		if (msg.replyingTo) stats.withReplies++
		if (msg.tapback) stats.withTapbacks++
	})

	return stats
}

function displayStats(stats: Stats, source: string): void {
	console.log('\n✅ Valid schema!\n')
	console.log('📊 Summary:')
	console.log(`  Source: ${source || 'unknown'}`)
	console.log(`  Total messages: ${stats.total.toLocaleString()}`)
	console.log('\n  By message kind:')
	console.log(`    - text: ${stats.byKind.text.toLocaleString()}`)
	console.log(`    - media: ${stats.byKind.media.toLocaleString()}`)
	console.log(`    - tapback: ${stats.byKind.tapback.toLocaleString()}`)
	console.log(
		`    - notification: ${stats.byKind.notification.toLocaleString()}`,
	)

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

async function main(): Promise<void> {
	const filePath = process.argv[2]

	if (!filePath) {
		console.error('❌ Error: Missing file path argument\n')
		console.error('Usage: node scripts/validate-json.ts <file-path>')
		console.error(
			'Example: node scripts/validate-json.ts ./exports/messages.json\n',
		)
		process.exit(2)
	}

	const absolutePath = resolve(filePath)

	try {
		const content = readFileSync(absolutePath, 'utf-8')

		let data: unknown
		try {
			data = JSON.parse(content)
		} catch (parseError) {
			console.error(`❌ Invalid JSON in file: ${absolutePath}`)
			console.error(`Parse error: ${(parseError as Error).message}\n`)
			process.exit(2)
		}

		let messages: Message[] | undefined
		let source = 'unknown'
		let validationError: ZodError | Error | null = null

		if (
			data &&
			typeof data === 'object' &&
			!Array.isArray(data) &&
			'messages' in data
		) {
			// ExportEnvelope
			try {
				const envelope = ExportEnvelopeSchema.parse(data) as ExportEnvelope
				messages = envelope.messages
				source = envelope.source
			} catch (error) {
				validationError = error as ZodError
			}
		} else if (Array.isArray(data)) {
			// Array of messages
			try {
				messages = []
				for (const msg of data) {
					messages.push(MessageSchema.parse(msg) as Message)
				}
				source = 'array'
			} catch (error) {
				validationError = error as ZodError
			}
		} else {
			validationError = new Error(
				'Data is neither an ExportEnvelope nor an array of messages',
			)
		}

		if (validationError) {
			if ('errors' in validationError) {
				console.error(
					formatZodErrors(validationError as ZodError, absolutePath),
				)
			} else {
				console.error(`❌ Error: ${validationError.message}`)
			}
			console.error(
				'💡 Tip: If this is a plain array of messages, ensure each message conforms to MessageSchema.',
			)
			console.error(
				'    If this is an ExportEnvelope, ensure it has: schemaVersion, source, createdAt, messages\n',
			)
			process.exit(1)
		}

		if (!messages) {
			console.error('❌ Error: No messages found in data')
			process.exit(1)
		}

		const stats = calculateStats(messages)
		displayStats(stats, source)

		process.exit(0)
	} catch (error) {
		const err = error as NodeJS.ErrnoException
		if (err.code === 'ENOENT') {
			console.error(`❌ File not found: ${absolutePath}\n`)
			process.exit(2)
		} else if (err.code === 'EACCES') {
			console.error(`❌ Permission denied: ${absolutePath}\n`)
			process.exit(2)
		} else {
			console.error(`❌ Unexpected error: ${err.message}`)
			console.error(err.stack)
			process.exit(2)
		}
	}
}

void main()
