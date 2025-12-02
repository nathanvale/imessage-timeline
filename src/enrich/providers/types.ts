/**
 * Link Enrichment Provider Types
 *
 * Shared types for link enrichment providers.
 */

/**
 * Link context extracted from a URL
 */
export type LinkContext = {
	url: string
	title?: string
	description?: string
	provider:
		| 'gemini'
		| 'firecrawl'
		| 'local'
		| 'youtube'
		| 'spotify'
		| 'twitter'
		| 'instagram'
		| 'generic'
	usedFallback?: boolean
	failedProviders?: string[]
}

/**
 * Configuration for link enrichment
 */
export type LinkEnrichmentConfig = {
	enableLinkAnalysis: boolean
	firecrawlApiKey?: string
	youtubeApiKey?: string
	spotifyClientId?: string
	spotifyClientSecret?: string
	rateLimitDelay?: number
	maxRetries?: number
}

/**
 * Provider interface for cascading fallbacks
 */
export interface Provider {
	name: string
	priority: number
	detect: (url: string) => boolean
	extract: (url: string) => Promise<LinkContext>
}

/**
 * URL detection patterns for different provider types
 */
export const URL_PATTERNS = {
	youtube:
		/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i,
	spotify: /^https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)/i,
	twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)/i,
	instagram: /^https?:\/\/(www\.)?instagram\.com/i,
}
