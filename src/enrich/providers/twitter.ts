/**
 * Twitter Provider (ENRICH--T04-AC04)
 *
 * Fallback provider for Twitter/X post metadata extraction.
 */

import { createLogger } from '#utils/logger'
import type { LinkContext, Provider } from './types.js'
import { URL_PATTERNS } from './types.js'

const logger = createLogger('enrich:twitter-provider')

/**
 * AC04: Twitter Provider (social media fallback)
 */
export class TwitterProvider implements Provider {
	name = 'twitter'
	priority = 3

	detect(url: string): boolean {
		return URL_PATTERNS.twitter.test(url)
	}

	async extract(url: string): Promise<LinkContext> {
		try {
			// Extract tweet ID from URL
			const tweetIdMatch = url.match(/\/status\/(\d+)/)
			const tweetId = tweetIdMatch?.[1]

			if (!tweetId) {
				throw new Error('Could not extract tweet ID')
			}

			// In production, would parse meta tags or use Twitter API
			const title = `Tweet: ${tweetId}`

			logger.debug(`Twitter extracted metadata for ${url}`)
			return {
				url,
				title,
				description: 'Tweet from Twitter/X',
				provider: 'twitter',
				usedFallback: true,
			}
		} catch (error) {
			logger.error(`Twitter extraction failed for ${url}`, { error })
			throw error
		}
	}
}
