#!/usr/bin/env node
/**
 * iMessage Timeline CLI
 *
 * Main CLI entry point that registers all commands and handles execution.
 * This is the modular replacement for the monolithic cli.ts file.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command, type CommanderError } from 'commander'
import { humanError, setHumanLoggingEnabled } from '#utils/human'
import { createLogger } from '#utils/logger'
import {
	registerCleanCommand,
	registerDoctorCommand,
	registerEnrichAICommand,
	registerIngestCSVCommand,
	registerIngestDBCommand,
	registerInitCommand,
	registerNormalizeLinkCommand,
	registerRenderMarkdownCommand,
	registerStatsCommand,
	registerValidateCommand,
} from './commands/index.js'
import type { GlobalOptions } from './types.js'

// Get package.json for version
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path is relative to the bundled output location (dist/bin/index.js)
const packageJsonPath = resolve(__dirname, '../../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

// Create CLI logger
const cliLogger = createLogger('cli')

/**
 * Creates and configures the main CLI program with all commands.
 */
export function createProgram(): Command {
	const program = new Command()

	program
		.name('chatline')
		.description(
			'Extract, transform, and analyze iMessage conversations with AI-powered enrichment and timeline rendering',
		)
		.version(packageJson.version)

	// Global options
	program
		.option('-v, --verbose', 'enable verbose logging', false)
		.option('-q, --quiet', 'suppress non-error output', false)
		.option(
			'-c, --config <path>',
			'path to config file',
			'imessage-config.json',
		)
		.option(
			'--json',
			'emit structured JSON log events only (machine-readable)',
			false,
		)

	// Toggle human logging before each command action
	program.hook('preAction', () => {
		const opts = program.opts<{ json?: boolean }>()
		const envJson = String(process.env.IMESSAGE_JSON || '').toLowerCase()
		const envJsonOnly = ['1', 'true', 'yes', 'y', 'json', 'json-only'].includes(
			envJson,
		)
		const jsonOnly = Boolean(opts.json) || envJsonOnly
		setHumanLoggingEnabled(!jsonOnly)
	})

	// Custom error handling
	program.configureOutput({
		outputError: (str: string, write: (msg: string) => void) => {
			const errorMsg = str
				.replace(/^error: /, '❌ Error: ')
				.replace(/^Error: /, '❌ Error: ')
			write(errorMsg)
			cliLogger.error('Commander output error', { raw: str })
		},
	})

	// Custom error handler for better error messages
	program.exitOverride((err: CommanderError) => {
		if (
			err.code === 'commander.help' ||
			err.code === 'commander.helpDisplayed'
		) {
			process.exit(0)
		}
		if (err.code === 'commander.version') {
			process.exit(0)
		}
		if (err.code === 'commander.missingArgument') {
			humanError(`❌ Error: ${err.message}`)
			humanError(
				`\nRun 'chatline ${program.args[0] || ''} --help' for usage information`,
			)
			process.exit(1)
		}
		if (err.code === 'commander.unknownCommand') {
			humanError(`❌ Error: ${err.message}`)
			humanError(`\nRun 'chatline --help' to see available commands`)
			process.exit(1)
		}
		humanError(`❌ Error: ${err.message}`)
		cliLogger.error('CLI exit override error', {
			code: err.code,
			message: err.message,
		})
		process.exit(err.exitCode || 1)
	})

	// Function to get global options - passed to each command registration
	const getGlobalOptions = (): GlobalOptions => program.opts<GlobalOptions>()

	// Register all commands with the shared global options getter
	registerIngestCSVCommand(program, getGlobalOptions)
	registerIngestDBCommand(program, getGlobalOptions)
	registerNormalizeLinkCommand(program, getGlobalOptions)
	registerEnrichAICommand(program, getGlobalOptions)
	registerRenderMarkdownCommand(program, getGlobalOptions)
	registerValidateCommand(program, getGlobalOptions)
	registerStatsCommand(program, getGlobalOptions)
	registerCleanCommand(program, getGlobalOptions)
	registerDoctorCommand(program, getGlobalOptions)
	registerInitCommand(program, getGlobalOptions)

	return program
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
	const program = createProgram()

	try {
		await program.parseAsync(process.argv)
	} catch (error) {
		// Commander handles most errors, but catch any uncaught ones
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`)
			process.exitCode = 1
		} else {
			throw error
		}
	}
}

// Run CLI if this is the main module
main().catch((error) => {
	console.error('Unexpected error:', error)
	process.exitCode = 1
})
