import { existsSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import type { MediaProvenance, Message } from '../schema/message'

type MessageWithMetadata = Message & { exportMetadata?: { source?: string } }

export type PathValidationConfig = {
	attachmentRoots: string[]
	source: 'csv' | 'db' | 'merged'
}

export type PathValidationStats = {
	total: number
	found: number
	missing: number
	notAbsolute: number
	errors: Array<{
		guid: string
		filename: string
		error: string
	}>
}

export type PathValidationResult = {
	messages: Message[]
	stats: PathValidationStats
}

/**
 * Validate that a path is absolute (starts with /)
 * AC01: All media.path fields are absolute paths when files exist on disk
 */
export function isAbsolutePath(filePath: string | null | undefined): boolean {
	if (!filePath || typeof filePath !== 'string') {
		return false
	}
	return filePath.startsWith('/')
}

/**
 * Check if a file exists on the filesystem
 */
export function fileExists(filePath: string | null | undefined): boolean {
	if (!filePath || typeof filePath !== 'string') {
		return false
	}
	try {
		return existsSync(filePath)
	} catch {
		return false
	}
}

/**
 * Expand tilde in paths to home directory
 */
export function expandTildeInPath(filePath: string): string {
	if (filePath.startsWith('~')) {
		return filePath.replace('~', os.homedir())
	}
	return filePath
}

/**
 * Search for an attachment file in configured root directories
 * AC04: Support multiple attachment root directories from config
 * Tries multiple strategies:
 * 1. If filename is absolute and exists, return it
 * 2. Try direct join of root + filename
 * 3. Search for basename in root
 */
export function searchAttachmentInRoots(
	filename: string,
	attachmentRoots: string[],
): string | null {
	if (!filename || attachmentRoots.length === 0) {
		return null
	}

	for (const root of attachmentRoots) {
		// Expand tilde in root directory
		const expandedRoot = expandTildeInPath(root)

		// Try direct file join
		const directPath = path.join(expandedRoot, filename)
		if (fileExists(directPath)) {
			return directPath
		}

		// Try basename matching (file in any subdirectory of root)
		try {
			const basename = path.basename(filename)
			const basenameOnly = path.join(expandedRoot, basename)
			if (fileExists(basenameOnly)) {
				return basenameOnly
			}
		} catch {
			// Continue to next root
		}
	}

	return null
}

/**
 * Infer the source (csv/db) from message metadata or GUID pattern
 */
export function inferSource(
	message: Message,
	defaultSource: 'csv' | 'db' | 'merged',
): 'csv' | 'db' {
	// Check guid pattern
	if (message.guid?.startsWith('p:')) {
		// Part GUID format: p:index/guid
		return 'db'
	}
	if (message.guid?.startsWith('csv:')) {
		return 'csv'
	}

	// Check if there's explicit metadata
	const msgWithMeta = message as MessageWithMetadata
	if (msgWithMeta.exportMetadata?.source === 'csv') {
		return 'csv'
	}
	if (msgWithMeta.exportMetadata?.source === 'db') {
		return 'db'
	}

	// Default fallback
	return defaultSource === 'csv' ? 'csv' : 'db'
}

/**
 * Create provenance metadata for a media file
 * AC02: Missing files retain original filename with provenance metadata
 */
export function createProvenance(
	message: Message,
	source: 'csv' | 'db' | 'merged',
): MediaProvenance {
	const now = new Date().toISOString()
	return {
		source: source as 'csv' | 'db' | 'merged',
		lastSeen: message.date,
		resolvedAt: now,
	}
}

/**
 * Validate and enforce absolute paths for all media messages
 *
 * AC01: All media.path fields are absolute paths when files exist on disk
 * AC02: Missing files retain original filename with provenance metadata
 * AC03: Path validation errors reported with counters (found vs missing)
 * AC04: Support multiple attachment root directories from config
 */
export function validateAndEnforcePaths(
	messages: Message[],
	config: PathValidationConfig,
): PathValidationResult {
	const result: PathValidationResult = {
		messages: [],
		stats: {
			total: 0,
			found: 0,
			missing: 0,
			notAbsolute: 0,
			errors: [],
		},
	}

	for (const message of messages) {
		// Only process media messages
		if (message.messageKind !== 'media' || !message.media) {
			result.messages.push(message)
			continue
		}

		const updatedMessage = { ...message }
		const media = { ...message.media }

		result.stats.total++

		let resolvedPath = media.path
		let pathAbsolute = isAbsolutePath(resolvedPath)
		let pathExists = fileExists(resolvedPath)

		// If path is not absolute, try to resolve it
		if (!pathAbsolute && resolvedPath) {
			// Try expanding tilde
			const expanded = expandTildeInPath(resolvedPath)
			if (fileExists(expanded)) {
				resolvedPath = expanded
				pathAbsolute = true
				pathExists = true
			}
		}

		// If still not absolute, try searching in attachment roots
		if (!pathAbsolute && media.filename) {
			const found = searchAttachmentInRoots(
				media.filename,
				config.attachmentRoots,
			)
			if (found) {
				resolvedPath = found
				pathAbsolute = true
				pathExists = true
			}
		}

		// Update statistics and path
		if (pathAbsolute && pathExists) {
			result.stats.found++
			media.path = resolvedPath!
		} else if (pathAbsolute && !pathExists) {
			// Path is absolute but file not found
			result.stats.missing++
			const error = `File not found at path: ${resolvedPath}`
			result.stats.errors.push({
				guid: message.guid,
				filename: media.filename,
				error,
			})
		} else if (!pathAbsolute) {
			// Path is not absolute
			result.stats.notAbsolute++
			const error = `Path is not absolute: ${resolvedPath || '(empty)'}`
			result.stats.errors.push({
				guid: message.guid,
				filename: media.filename,
				error,
			})
		} else {
			// Unknown state
			result.stats.missing++
			const error = 'Could not resolve path'
			result.stats.errors.push({
				guid: message.guid,
				filename: media.filename,
				error,
			})
		}

		// AC02: Add provenance metadata
		const _source = inferSource(message, config.source)
		media.provenance = createProvenance(message, config.source)

		updatedMessage.media = media
		result.messages.push(updatedMessage)
	}

	return result
}

/**
 * Format path validation statistics as human-readable string for logging
 */
export function formatPathValidationStats(stats: PathValidationStats): string {
	const lines = [
		'📁 Path Validation Report',
		`   Total media files: ${stats.total}`,
		`   ✓ Found (absolute & exists): ${stats.found}`,
		`   ✗ Missing (absolute but no file): ${stats.missing}`,
		`   ⚠ Not absolute: ${stats.notAbsolute}`,
	]

	if (stats.errors.length > 0) {
		lines.push(`   Errors (${stats.errors.length}):`)
		stats.errors.slice(0, 5).forEach((err) => {
			lines.push(`     - ${err.filename} (${err.guid}): ${err.error}`)
		})
		if (stats.errors.length > 5) {
			lines.push(`     ... and ${stats.errors.length - 5} more`)
		}
	}

	return lines.join('\n')
}
