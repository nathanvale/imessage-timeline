/**
 * Init Command
 *
 * Generate starter configuration file.
 * CONFIG-T03: Implement config generator
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import type { GlobalOptions, InitOptions } from '../types.js'
import { applyLogLevel, logEvent } from '../utils.js'

/**
 * Execute the init command logic
 */
export async function executeInit(
	options: InitOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const { format, force, output } = options
	const { verbose, quiet } = globalOptions

	applyLogLevel(verbose, quiet)

	// Validate format
	if (format !== 'json' && format !== 'yaml') {
		humanError(`❌ Invalid format: ${format}`)
		humanError('Supported formats: json, yaml')
		process.exit(1)
	}

	// Lazy import to avoid circular dependencies
	const { generateConfigFile, getDefaultConfigPath, configFileExists } =
		await import('../../config/generator.js')

	// Determine output path
	const filePath = output || getDefaultConfigPath(format)

	// CONFIG-T03-AC04: Check for existing file and prompt if needed
	const exists = await configFileExists(filePath)
	if (exists && !force) {
		humanError(`❌ Config file already exists: ${filePath}`)
		humanError('\nOptions:')
		humanError('  • Use --force to overwrite')
		humanError('  • Use --output to specify different path')
		humanError('  • Manually remove the existing file')
		process.exit(1)
	}

	// CONFIG-T03-AC01, AC02, AC03: Generate config file
	const result = await generateConfigFile({
		filePath,
		format,
		force,
	})

	if (result.success) {
		humanInfo(result.message)
		humanInfo('\n📝 Next steps:')
		humanInfo(`  1. Edit ${filePath} to add your API keys`)
		humanInfo('  2. Set GEMINI_API_KEY environment variable')
		humanInfo(
			'  3. (Optional) Set FIRECRAWL_API_KEY for enhanced link scraping',
		)
		humanInfo('\n💡 See inline comments in the config file for details')
		logEvent('init-summary', {
			command: 'init',
			phase: 'summary',
			options: { format, filePath, force },
			message: result.message,
			exitCode: 0,
		})
		process.exit(0)
	} else {
		humanError(`❌ ${result.message}`)
		logEvent('init-error', {
			command: 'init',
			phase: 'error',
			options: { format, filePath, force },
			message: result.message,
			exitCode: 1,
		})
		process.exit(1)
	}
}

/**
 * Register the init command with Commander
 */
export function registerInitCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('init')
		.description('Generate starter configuration file')
		.option('-f, --format <type>', 'config file format (json|yaml)', 'yaml')
		.option(
			'--force',
			'overwrite existing config file without prompting',
			false,
		)
		.option(
			'-o, --output <path>',
			'output file path (default: auto-detected from format)',
		)
		.action(async (options: InitOptions) => {
			try {
				await executeInit(options, getGlobalOptions())
			} catch (error) {
				humanError(
					'❌ Failed to generate config:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('init-runtime-error', {
					command: 'init',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					options: {
						format: options.format,
						output: options.output,
						force: options.force,
					},
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
