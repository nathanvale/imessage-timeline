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

export {
	generateConfigContent,
	getDefaultConfigPath,
	validateGeneratedConfig,
} from './config/generator.js'
// ===== Config Management =====
export {
	clearConfigCache,
	discoverConfigFile,
	isConfigCached,
	loadConfig,
	loadConfigFile,
	mergeConfig,
	substituteEnvVars,
} from './config/loader.js'
export type { Config, ConfigFormat } from './config/schema.js'
export {
	CONFIG_FILE_PATTERNS,
	DEFAULT_CONFIG,
	detectConfigFormat,
	validateConfig,
	validateConfigSafe,
} from './config/schema.js'
export type {
	ApiResponse,
	RateLimitConfig,
	RateLimitState,
} from './enrich/rate-limiting.js'
// ===== Rate Limiting =====
export {
	createRateLimiter,
	is5xx,
	isRetryableStatus,
	RateLimiter,
} from './enrich/rate-limiting.js'
export type {
	MergeResult as IngestMergeResult,
	MergeStats,
} from './ingest/dedup-merge.js'
export { dedupAndMerge } from './ingest/dedup-merge.js'
export type { CSVRow, IngestOptions } from './ingest/ingest-csv.js'
// ===== Ingest Functions =====
export { createExportEnvelope, ingestCSV } from './ingest/ingest-csv.js'
// ===== Core Types & Schemas =====
export type {
	ChatId,
	ExportEnvelope,
	MediaEnrichment,
	MediaKind,
	MediaMeta,
	MediaProvenance,
	Message,
	MessageCore,
	MessageGUID,
	ReplyInfo,
	TapbackInfo,
} from './schema/message.js'
export {
	MediaEnrichmentSchema,
	MediaMetaSchema,
	MediaProvenanceSchema,
	MessageCoreSchema,
	ReplyInfoSchema,
	TapbackInfoSchema,
} from './schema/message.js'
export type { DeltaResult } from './utils/delta-detection.js'
// ===== Utilities =====
export {
	detectDelta,
	extractGuidsFromMessages,
	getDeltaStats,
	logDeltaSummary,
} from './utils/delta-detection.js'
export type {
	MergeOptions,
	MergeResult as EnrichmentMergeResult,
	MergeStatistics,
} from './utils/enrichment-merge.js'
export { mergeEnrichments } from './utils/enrichment-merge.js'
