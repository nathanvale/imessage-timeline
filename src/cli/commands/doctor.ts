/**
 * Doctor Command
 *
 * Diagnose common configuration issues.
 * CLI-T05-AC04: doctor command to diagnose common issues
 */

import type { Command } from 'commander'
import { humanError, humanInfo } from '#utils/human'
import type { DoctorOptions, GlobalOptions } from '../types.js'
import { applyLogLevel, logEvent } from '../utils.js'

/**
 * Execute the doctor command logic
 */
export async function executeDoctor(
	options: DoctorOptions,
	globalOptions: GlobalOptions,
): Promise<void> {
	const verbose = globalOptions.verbose || options.verbose || false

	applyLogLevel(verbose, globalOptions.quiet)

	const fs = await import('node:fs')
	const path = await import('node:path')
	const os = await import('node:os')

	humanInfo('🔍 iMessage Timeline Diagnostics\n')
	logEvent('doctor-start', { command: 'doctor', phase: 'start' })

	const checks: Array<{ name: string; pass: boolean; message: string }> = []

	// Check 1: Node version
	const nodeVersion = process.version
	const nodeMajor = Number.parseInt(
		nodeVersion.slice(1).split('.')[0] ?? '0',
		10,
	)
	const nodeOk = nodeMajor >= 18
	checks.push({
		name: 'Node.js version',
		pass: nodeOk,
		message: `${nodeVersion} ${nodeOk ? '✓' : '(requires ≥18)'}`,
	})

	// Check 2: Current directory
	const cwd = process.cwd()
	const packageJsonExists = fs.existsSync(path.join(cwd, 'package.json'))
	checks.push({
		name: 'package.json',
		pass: packageJsonExists,
		message: packageJsonExists
			? `Found in ${cwd}`
			: 'Not found in current directory',
	})

	// Check 3: Config file
	const configFormats = [
		'imessage-config.yaml',
		'imessage-config.yml',
		'imessage-config.json',
	]
	const foundConfig = configFormats.find((f) =>
		fs.existsSync(path.join(cwd, f)),
	)
	checks.push({
		name: 'Config file',
		pass: Boolean(foundConfig),
		message: foundConfig
			? `Found: ${foundConfig}`
			: 'Not found (run: chatline init)',
	})

	// Check 4: API Keys
	const geminiKey = process.env.GEMINI_API_KEY
	const firecrawlKey = process.env.FIRECRAWL_API_KEY
	checks.push({
		name: 'GEMINI_API_KEY',
		pass: Boolean(geminiKey),
		message: geminiKey
			? 'Set'
			: 'Not set (required for image/audio enrichment)',
	})

	checks.push({
		name: 'FIRECRAWL_API_KEY',
		pass: Boolean(firecrawlKey),
		message: firecrawlKey
			? 'Set'
			: 'Not set (optional, improves link enrichment - get from firecrawl.dev)',
	})

	// Check 5: Default attachment directory
	const defaultAttachDir = path.join(
		os.homedir(),
		'Library',
		'Messages',
		'Attachments',
	)
	const attachDirExists = fs.existsSync(defaultAttachDir)
	checks.push({
		name: 'Messages attachments',
		pass: attachDirExists,
		message: attachDirExists
			? `Found: ${defaultAttachDir}`
			: `Not found: ${defaultAttachDir}`,
	})

	// Check 6: Output directory permission
	const canWrite = (() => {
		try {
			const testFile = path.join(cwd, '.test-write')
			fs.writeFileSync(testFile, 'test')
			fs.unlinkSync(testFile)
			return true
		} catch {
			return false
		}
	})()
	checks.push({
		name: 'Write permission',
		pass: canWrite,
		message: canWrite
			? `Can write to ${cwd}`
			: `Cannot write to ${cwd} (check permissions)`,
	})

	// Print results
	let passCount = 0
	checks.forEach((check) => {
		const icon = check.pass ? '✅' : '⚠️ '
		humanInfo(`${icon} ${check.name.padEnd(25)} ${check.message}`)
		if (check.pass) passCount++
		logEvent('doctor-check', {
			command: 'doctor',
			phase: 'progress',
			context: { name: check.name },
			metrics: { pass: check.pass },
			message: check.message,
		})
	})

	humanInfo(`\n📊 Summary: ${passCount}/${checks.length} checks passed`)
	logEvent('doctor-summary', {
		command: 'doctor',
		phase: 'summary',
		metrics: { passed: passCount, total: checks.length },
	})

	// Recommendations
	const failures = checks.filter((c) => !c.pass)
	if (failures.length > 0) {
		humanInfo('\n💡 Recommendations:')
		failures.forEach((check) => {
			if (check.name === 'Config file') {
				humanInfo('   • Run: chatline init')
			} else if (check.name === 'GEMINI_API_KEY') {
				humanInfo(
					'   • Get API key from: https://ai.google.dev/tutorials/setup',
				)
				humanInfo('   • Set: export GEMINI_API_KEY=your_key')
			} else if (check.name === 'FIRECRAWL_API_KEY') {
				humanInfo('   • (Optional) Get from: https://www.firecrawl.dev')
			}
			logEvent('doctor-recommendation', {
				command: 'doctor',
				phase: 'progress',
				context: { name: check.name },
				message: check.message,
			})
		})
	}

	if (verbose) {
		humanInfo('\n📝 Environment:')
		humanInfo(`   Platform: ${os.platform()}`)
		humanInfo(`   Arch: ${os.arch()}`)
		humanInfo(`   Home: ${os.homedir()}`)
		humanInfo(`   CWD: ${cwd}`)
		logEvent('doctor-environment', {
			command: 'doctor',
			phase: 'progress',
			context: {
				platform: os.platform(),
				arch: os.arch(),
				home: os.homedir(),
				cwd,
			},
		})
	}

	logEvent('doctor-exit', {
		command: 'doctor',
		phase: 'summary',
		metrics: { failures: failures.length },
		exitCode: failures.length > 0 ? 1 : 0,
	})
	process.exit(failures.length > 0 ? 1 : 0)
}

/**
 * Register the doctor command with Commander
 */
export function registerDoctorCommand(
	program: Command,
	getGlobalOptions: () => GlobalOptions,
): void {
	program
		.command('doctor')
		.description('Diagnose common configuration issues')
		.option('-v, --verbose', 'show detailed diagnostics', false)
		.action(async (options: DoctorOptions) => {
			try {
				await executeDoctor(options, getGlobalOptions())
			} catch (error) {
				humanError(
					'❌ Doctor failed:',
					error instanceof Error ? error.message : String(error),
				)
				if (getGlobalOptions().verbose && error instanceof Error) {
					humanError(error.stack)
				}
				logEvent('doctor-error', {
					command: 'doctor',
					phase: 'error',
					error: {
						type: error instanceof Error ? error.name : 'Unknown',
						message: error instanceof Error ? error.message : String(error),
						...(error instanceof Error && error.stack
							? { stack: error.stack }
							: {}),
					},
					exitCode: 2,
				})
				process.exit(2)
			}
		})
}
