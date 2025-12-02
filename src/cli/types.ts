/**
 * CLI Option Types
 *
 * Shared type definitions for all CLI command options.
 */

export type RenderMarkdownOptions = {
	input: string
	output?: string
	startDate?: string
	endDate?: string
	groupByTime?: boolean
	nestedReplies?: boolean
	maxNestingDepth?: string
}

export type ValidateOptions = {
	input: string
	quiet?: boolean
}

export type StatsOptions = {
	input: string
	verbose?: boolean
}

export type CleanOptions = {
	checkpointDir: string
	force?: boolean
	all?: boolean
}

export type DoctorOptions = {
	verbose?: boolean
}

export type InitOptions = {
	format: 'json' | 'yaml'
	force: boolean
	output?: string
}

export type IngestCSVOptions = {
	input: string
	output: string
	attachments?: Array<string>
}

export type IngestDBOptions = {
	input: string
	output: string
	attachments?: Array<string>
	contact?: string
}

export type NormalizeLinkOptions = {
	input: Array<string> | string
	output: string
}

export type EnrichAIOptions = {
	input: string
	output: string
	checkpointDir: string
	resume?: boolean
	incremental?: boolean
	stateFile?: string
	resetState?: boolean
	forceRefresh?: boolean
	rateLimitMs?: string
	maxRetries?: string
	checkpointInterval?: string
	enableVision?: boolean
	enableAudio?: boolean
	enableLinks?: boolean
}

/**
 * CLI Log Event Metadata
 */
export type CLILogMeta = {
	command: string
	phase: 'start' | 'progress' | 'summary' | 'warning' | 'error'
	message?: string
	options?: Record<string, unknown>
	metrics?: Record<string, unknown>
	error?: { type?: string; message: string; stack?: string }
	context?: Record<string, unknown>
	exitCode?: number
}

/**
 * Global CLI options from Commander program
 */
export type GlobalOptions = {
	verbose: boolean
	quiet: boolean
	config: string
	json?: boolean
}
