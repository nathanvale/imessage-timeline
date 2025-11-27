/**
 * CLI Commands Index
 *
 * Barrel export for all CLI command modules.
 */

export { executeClean, registerCleanCommand } from './clean.js'
export { executeDoctor, registerDoctorCommand } from './doctor.js'
export { executeEnrichAI, registerEnrichAICommand } from './enrich-ai.js'
export { executeIngestCSV, registerIngestCSVCommand } from './ingest-csv.js'
export { executeIngestDB, registerIngestDBCommand } from './ingest-db.js'
export { executeInit, registerInitCommand } from './init.js'
export {
	executeNormalizeLink,
	registerNormalizeLinkCommand,
} from './normalize-link.js'
export {
	executeRenderMarkdown,
	registerRenderMarkdownCommand,
} from './render-markdown.js'
export { executeStats, registerStatsCommand } from './stats.js'
export { executeValidate, registerValidateCommand } from './validate.js'
