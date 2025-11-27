/**
 * YouTube Provider (ENRICH--T04-AC02)
 *
 * Fallback provider for YouTube video metadata extraction.
 */

import { createLogger } from '#utils/logger'
import type { LinkContext, Provider } from './types.js'
import { URL_PATTERNS } from './types.js'

const logger = createLogger('enrich:youtube-provider')

/**
 * AC02: YouTube Provider (fallback)
 */
export class YouTubeProvider implements Provider {
	name = 'youtube'
	priority = 1

	detect(url: string): boolean {
		return URL_PATTERNS.youtube.test(url)
	}

	async extract(url: string): Promise<LinkContext> {
		try {
			// Extract video ID from URL
			const videoIdMatch = url.match(
				/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
			)
			const videoId = videoIdMatch?.[1]

			if (!videoId) {
				throw new Error('Could not extract YouTube video ID')
			}

			// In production, would fetch from YouTube API or parse HTML
			const title = `YouTube Video: ${videoId}`

			logger.debug(`YouTube extracted metadata for ${url}`)
			return {
				url,
				title,
				description: 'YouTube video',
				provider: 'youtube',
				usedFallback: true,
			}
		} catch (error) {
			logger.error(`YouTube extraction failed for ${url}`, { error })
			throw error
		}
	}
}
