/**
 * Public API for imessage-timeline library
 *
 * This package can be used both as:
 * 1. CLI tool: `npx imessage-timeline --help`
 * 2. Library: `import { loadConfig, ingestCSV } from 'imessage-timeline'`
 *
 * @packageDocumentation
 * @module imessage-timeline
 */

// ===== Core Types & Schemas =====
export type {
	Message,
	MessageCore,
	MessageGUID,
	ChatId,
	MediaMeta,
	MediaKind,
	MediaEnrichment,
	MediaProvenance,
	ReplyInfo,
	TapbackInfo,
	ExportEnvelope,
} from './schema/message.js'

export {
	MediaEnrichmentSchema,
	MediaProvenanceSchema,
	MediaMetaSchema,
	ReplyInfoSchema,
	TapbackInfoSchema,
	MessageCoreSchema,
} from './schema/message.js'

// ===== Config Management =====
export {
	loadConfig,
	loadConfigFile,
	discoverConfigFile,
	substituteEnvVars,
	mergeConfig,
	clearConfigCache,
	isConfigCached,
} from './config/loader.js'

export {
	generateConfigContent,
	validateGeneratedConfig,
	getDefaultConfigPath,
} from './config/generator.js'

export type { Config, ConfigFormat } from './config/schema.js'
export {
	validateConfig,
	validateConfigSafe,
	DEFAULT_CONFIG,
	CONFIG_FILE_PATTERNS,
	detectConfigFormat,
} from './config/schema.js'

// ===== Ingest Functions =====
export { ingestCSV, createExportEnvelope } from './ingest/ingest-csv.js'
export type { IngestOptions, CSVRow } from './ingest/ingest-csv.js'

export { dedupAndMerge } from './ingest/dedup-merge.js'
export type {
	MergeStats,
	MergeResult as IngestMergeResult,
} from './ingest/dedup-merge.js'

// ===== Utilities =====
export {
	detectDelta,
	extractGuidsFromMessages,
	logDeltaSummary,
	getDeltaStats,
} from './utils/delta-detection.js'

export type { DeltaResult } from './utils/delta-detection.js'

export { mergeEnrichments } from './utils/enrichment-merge.js'
export type {
	MergeOptions,
	MergeStatistics,
	MergeResult as EnrichmentMergeResult,
} from './utils/enrichment-merge.js'

// ===== Rate Limiting =====
export {
	createRateLimiter,
	is5xx,
	isRetryableStatus,
	RateLimiter,
} from './enrich/rate-limiting.js'

export type {
	RateLimitConfig,
	RateLimitState,
	ApiResponse,
} from './enrich/rate-limiting.js'
