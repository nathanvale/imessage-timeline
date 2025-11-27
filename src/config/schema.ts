/**
 * Configuration Schema for iMessage Timeline
 *
 * Implements CONFIG--T01: Define Config Schema
 * Supports both JSON and YAML formats with Zod validation
 */

import { z } from 'zod'

/**
 * CONFIG-T01-AC01: Config schema with Zod validation
 *
 * Gemini API configuration for AI-powered enrichment
 */
const GeminiConfigSchema = z.object({
	apiKey: z.string().min(1, 'Gemini API key is required'),
	model: z.string().default('gemini-1.5-pro'),
	rateLimitDelay: z.number().min(0).default(1000),
	maxRetries: z.number().min(0).max(10).default(3),
})

/**
 * Firecrawl API configuration for link enrichment (optional)
 */
const FirecrawlConfigSchema = z
	.object({
		apiKey: z.string().optional(),
		enabled: z.boolean().default(true),
	})
	.optional()

/**
 * Enrichment pipeline configuration
 */
const EnrichmentConfigSchema = z.object({
	enableVisionAnalysis: z.boolean().default(true),
	enableAudioTranscription: z.boolean().default(true),
	enableLinkEnrichment: z.boolean().default(true),
	imageCacheDir: z.string().default('./.cache/images'),
	checkpointInterval: z.number().min(1).max(10000).default(100),
	forceRefresh: z.boolean().default(false),
})

/**
 * Markdown rendering configuration
 */
const RenderConfigSchema = z.object({
	groupByTimeOfDay: z.boolean().default(true),
	renderRepliesAsNested: z.boolean().default(true),
	renderTapbacksAsEmoji: z.boolean().default(true),
	maxNestingDepth: z.number().min(1).max(100).default(10),
})

/**
 * TypeScript type for the full configuration
 * Explicitly defined for DTS generation compatibility
 */
export type Config = {
	version: string
	attachmentRoots: string[]
	gemini: {
		apiKey: string
		model: string
		rateLimitDelay: number
		maxRetries: number
	}
	firecrawl?: {
		apiKey?: string
		enabled: boolean
	}
	enrichment: {
		enableVisionAnalysis: boolean
		enableAudioTranscription: boolean
		enableLinkEnrichment: boolean
		imageCacheDir: string
		checkpointInterval: number
		forceRefresh: boolean
	}
	render: {
		groupByTimeOfDay: boolean
		renderRepliesAsNested: boolean
		renderTapbacksAsEmoji: boolean
		maxNestingDepth: number
	}
}

/**
 * CONFIG-T01-AC01: Main configuration schema
 *
 * Supports:
 * - CONFIG-T01-AC02: JSON and YAML formats
 * - CONFIG-T01-AC03: Environment variable interpolation via ${ENV_VAR}
 * - CONFIG-T01-AC05: Validation errors with field paths
 */
export const ConfigSchema: z.ZodType<Config, z.ZodTypeDef, unknown> = z.object({
	version: z.string().default('1.0'),
	attachmentRoots: z
		.array(z.string().min(1, 'Attachment root path cannot be empty'))
		.min(1, 'At least one attachment root is required')
		.default(['~/Library/Messages/Attachments']),
	gemini: GeminiConfigSchema,
	firecrawl: FirecrawlConfigSchema,
	enrichment: EnrichmentConfigSchema.default({
		enableVisionAnalysis: true,
		enableAudioTranscription: true,
		enableLinkEnrichment: true,
		imageCacheDir: './.cache/images',
		checkpointInterval: 100,
		forceRefresh: false,
	}),
	render: RenderConfigSchema.default({
		groupByTimeOfDay: true,
		renderRepliesAsNested: true,
		renderTapbacksAsEmoji: true,
		maxNestingDepth: 10,
	}),
})

/**
 * CONFIG-T01-AC05: Validate config with detailed error messages
 *
 * @param config - Raw config object (parsed from JSON/YAML)
 * @returns Validated and typed config object
 * @throws ZodError with field paths and expected types
 *
 * @example
 * ```typescript
 * try {
 *   const config = validateConfig(rawConfig)
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     error.errors.forEach(err => {
 *       console.error(`${err.path.join('.')}: ${err.message}`)
 *     })
 *   }
 * }
 * ```
 */
export function validateConfig(config: unknown): Config {
	return ConfigSchema.parse(config)
}

/**
 * Validate config and return result with detailed errors
 *
 * @param config - Raw config object
 * @returns Validation result with success flag and data/errors
 */
export function validateConfigSafe(config: unknown): {
	success: boolean
	data?: Config
	errors?: Array<{ path: string; message: string }>
} {
	const result = ConfigSchema.safeParse(config)

	if (result.success) {
		return { success: true, data: result.data }
	}

	return {
		success: false,
		errors: result.error.errors.map((err) => ({
			path: err.path.join('.'),
			message: err.message,
		})),
	}
}

/**
 * Default configuration values
 *
 * Used as fallback when no config file is present
 */
export const DEFAULT_CONFIG: Partial<Config> = {
	version: '1.0',
	attachmentRoots: ['~/Library/Messages/Attachments'],
	enrichment: {
		enableVisionAnalysis: true,
		enableAudioTranscription: true,
		enableLinkEnrichment: true,
		imageCacheDir: './.cache/images',
		checkpointInterval: 100,
		forceRefresh: false,
	},
	render: {
		groupByTimeOfDay: true,
		renderRepliesAsNested: true,
		renderTapbacksAsEmoji: true,
		maxNestingDepth: 10,
	},
}

/**
 * CONFIG-T01-AC04: Config file discovery patterns
 *
 * Checked in order:
 * 1. ./imessage-config.yaml
 * 2. ./imessage-config.yml
 * 3. ./imessage-config.json
 */
export const CONFIG_FILE_PATTERNS = [
	'./imessage-config.yaml',
	'./imessage-config.yml',
	'./imessage-config.json',
] as const

/**
 * CONFIG-T01-AC02: Supported config file formats
 */
export type ConfigFormat = 'json' | 'yaml'

/**
 * Detect config file format from file extension
 */
export function detectConfigFormat(filePath: string): ConfigFormat {
	if (filePath.endsWith('.json')) {
		return 'json'
	}
	if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
		return 'yaml'
	}

	throw new Error(
		`Unsupported config file format: ${filePath}. Supported formats: .json, .yaml, .yml`,
	)
}
