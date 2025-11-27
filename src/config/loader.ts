/**
 * Configuration Loader for iMessage Timeline
 *
 * Implements CONFIG--T02: Implement Config Loader
 * Loads config from YAML/JSON files with env var substitution and precedence
 */

import { constants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'

import yaml from 'js-yaml'

import { type Config, detectConfigFormat, validateConfig } from './schema.js'

/**
 * In-memory cache for loaded configurations
 * CONFIG-T02-AC05: Cache loaded config to avoid repeated file reads
 */
let configCache: Config | null = null
let configCachePath: string | null = null

/**
 * CONFIG-T02-AC01: Discover config file in directory
 *
 * Checks files in order:
 * 1. imessage-config.yaml
 * 2. imessage-config.yml
 * 3. imessage-config.json
 *
 * @param baseDir - Directory to search in (defaults to current directory)
 * @returns Path to first existing config file, or null if none found
 */
export async function discoverConfigFile(
	baseDir: string = process.cwd(),
): Promise<string | null> {
	const fileNames = [
		'imessage-config.yaml',
		'imessage-config.yml',
		'imessage-config.json',
	]

	for (const fileName of fileNames) {
		const filePath = baseDir.startsWith('/')
			? `${baseDir}/${fileName}`
			: `./${baseDir}/${fileName}`.replace(/\/\.\//g, '/')

		try {
			await access(filePath, constants.R_OK)
			return filePath
		} catch {
			// File doesn't exist or not readable, try next
		}
	}

	return null
}

/**
 * CONFIG-T02-AC01: Load and parse config file
 *
 * Supports JSON and YAML formats with auto-detection
 *
 * @param filePath - Path to config file
 * @returns Parsed config object (unvalidated)
 * @throws Error if file cannot be read or parsed
 */
export async function loadConfigFile(filePath: string): Promise<unknown> {
	const content = await readFile(filePath, 'utf-8')
	const format = detectConfigFormat(filePath)

	if (format === 'json') {
		try {
			return JSON.parse(content)
		} catch (error) {
			throw new Error(
				`Failed to parse JSON config file ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
	} else if (format === 'yaml') {
		try {
			// js-yaml v4+ is safe by default - use JSON_SCHEMA for extra safety
			return yaml.load(content, { schema: yaml.JSON_SCHEMA })
		} catch (error) {
			throw new Error(
				`Failed to parse YAML config file ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
	}

	throw new Error(`Unsupported config format: ${filePath}`)
}

/**
 * CONFIG-T02-AC03: Substitute environment variables in config
 *
 * Recursively replaces ${VAR_NAME} patterns with environment variable values
 *
 * @param obj - Config object (or primitive)
 * @returns Object with env vars substituted
 *
 * @example
 * ```typescript
 * // With process.env.GEMINI_API_KEY = 'secret123'
 * substituteEnvVars({ apiKey: '${GEMINI_API_KEY}' })
 * // => { apiKey: 'secret123' }
 * ```
 */
export function substituteEnvVars(obj: unknown): unknown {
	// Handle strings - replace ${VAR} patterns
	if (typeof obj === 'string') {
		return obj.replace(/\$\{(\w+)\}/g, (_match, envVar) => {
			const value = process.env[envVar]
			if (value === undefined) {
				throw new Error(
					`Environment variable ${envVar} is not set but referenced in config`,
				)
			}
			return value
		})
	}

	// Handle arrays - recursively substitute each element
	if (Array.isArray(obj)) {
		return obj.map(substituteEnvVars)
	}

	// Handle objects - recursively substitute each value
	if (typeof obj === 'object' && obj !== null) {
		return Object.fromEntries(
			Object.entries(obj).map(([key, value]) => [
				key,
				substituteEnvVars(value),
			]),
		)
	}

	// Primitives (numbers, booleans, null) pass through unchanged
	return obj
}

/**
 * CONFIG-T02-AC02: Merge configuration with precedence
 *
 * Precedence (highest to lowest):
 * 1. CLI options
 * 2. Config file
 * 3. Defaults (applied by Zod schema)
 *
 * @param fileConfig - Config loaded from file
 * @param cliOptions - Options from CLI flags
 * @returns Merged config object
 */
export function mergeConfig(
	fileConfig: Partial<Config>,
	cliOptions: Partial<Config> = {},
): Partial<Config> {
	// Deep merge: CLI options override file config
	// Note: Zod schema will apply defaults for missing fields
	const merged: Partial<Config> = {
		...fileConfig,
		...cliOptions,
	}

	// Deep merge nested objects if they exist
	if (fileConfig.gemini || cliOptions.gemini) {
		merged.gemini = {
			...fileConfig.gemini,
			...cliOptions.gemini,
			// biome-ignore lint/suspicious/noExplicitAny: Zod schema mismatch with spread
		} as any
	}

	if (cliOptions.firecrawl !== undefined) {
		merged.firecrawl = cliOptions.firecrawl
	} else if (fileConfig.firecrawl !== undefined) {
		merged.firecrawl = fileConfig.firecrawl
	}

	if (fileConfig.enrichment || cliOptions.enrichment) {
		merged.enrichment = {
			...fileConfig.enrichment,
			...cliOptions.enrichment,
			// biome-ignore lint/suspicious/noExplicitAny: Zod schema mismatch with spread
		} as any
	}

	if (fileConfig.render || cliOptions.render) {
		merged.render = {
			...fileConfig.render,
			...cliOptions.render,
			// biome-ignore lint/suspicious/noExplicitAny: Zod schema mismatch with spread
		} as any
	}

	return merged
}

/**
 * CONFIG-T02: Main config loading function
 *
 * Loads configuration with the following precedence:
 * 1. CLI options (highest priority)
 * 2. Config file
 * 3. Defaults from schema (lowest priority)
 *
 * @param options - Loading options
 * @param options.configPath - Explicit config file path (optional)
 * @param options.cliOptions - CLI options to merge (optional)
 * @param options.skipCache - Force reload even if cached (optional)
 * @returns Validated and merged configuration
 * @throws Error if config is invalid or cannot be loaded
 *
 * @example
 * ```typescript
 * // Load with auto-discovery
 * const config = await loadConfig()
 *
 * // Load specific file
 * const config = await loadConfig({ configPath: './custom-config.yaml' })
 *
 * // Override with CLI options
 * const config = await loadConfig({
 *   cliOptions: {
 *     gemini: { apiKey: 'override-key' }
 *   }
 * })
 * ```
 */
export async function loadConfig(
	options: {
		configPath?: string
		cliOptions?: Partial<Config>
		skipCache?: boolean
	} = {},
): Promise<Config> {
	const { configPath, cliOptions = {}, skipCache = false } = options

	// CONFIG-T02-AC05: Return cached config if available
	if (!skipCache && configCache && configCachePath === configPath) {
		return configCache
	}

	// 1. Discover or use provided config file path
	const filePath = configPath || (await discoverConfigFile())

	// 2. Load config from file (if exists)
	let fileConfig: Partial<Config> = {}
	if (filePath) {
		try {
			const rawConfig = await loadConfigFile(filePath)

			// 3. CONFIG-T02-AC03: Substitute environment variables
			const withEnvVars = substituteEnvVars(rawConfig)

			fileConfig = withEnvVars as Partial<Config>
		} catch (error) {
			throw new Error(
				`Failed to load config from ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
	}

	// 4. CONFIG-T02-AC02: Merge with CLI options (CLI > file)
	const merged = mergeConfig(fileConfig, cliOptions)

	// 5. CONFIG-T02-AC04: Validate with schema and apply defaults
	try {
		const validated = validateConfig(merged)

		// Cache the result
		configCache = validated
		configCachePath = configPath || null

		return validated
	} catch (error) {
		throw new Error(
			`Config validation failed: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

/**
 * Clear the config cache
 *
 * Useful for testing or when config needs to be reloaded
 */
export function clearConfigCache(): void {
	configCache = null
	configCachePath = null
}

/**
 * Check if a config is currently cached
 *
 * @returns True if config is cached
 */
export function isConfigCached(): boolean {
	return configCache !== null
}
