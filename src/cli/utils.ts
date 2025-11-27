/**
 * CLI Utility Functions
 *
 * Shared utilities for CLI command handling including logging,
 * error handling, and common operations.
 */

import { createLogger, setLogLevel } from '#utils/logger'
import type { CLILogMeta } from './types.js'

/**
 * CLI Logger instance
 */
export const cliLogger = createLogger('cli')

/**
 * Apply log level based on verbose/quiet flags
 */
export function applyLogLevel(verbose: boolean, quiet: boolean): void {
	const level = quiet ? 'error' : verbose ? 'debug' : 'info'
	setLogLevel(level)
}

/**
 * Emit structured CLI events for logging
 */
export function logEvent(event: string, meta: CLILogMeta): void {
	cliLogger.info(event, meta)
}

/**
 * Format an error for CLI logging
 */
export function formatErrorMeta(error: unknown): CLILogMeta['error'] {
	return {
		type: error instanceof Error ? error.name : 'Unknown',
		message: error instanceof Error ? error.message : String(error),
		...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
	}
}

/**
 * Standard command error handler
 * Logs error and exits with specified code
 */
export function handleCommandError(
	commandName: string,
	error: unknown,
	verbose: boolean,
): never {
	const { humanError } = require('#utils/human')

	humanError(
		`❌ Failed to ${commandName}:`,
		error instanceof Error ? error.message : String(error),
	)

	if (verbose && error instanceof Error) {
		humanError(error.stack)
	}

	logEvent(`${commandName}-error`, {
		command: commandName,
		phase: 'error',
		error: formatErrorMeta(error),
		exitCode: 2,
	})

	process.exit(2)
}
