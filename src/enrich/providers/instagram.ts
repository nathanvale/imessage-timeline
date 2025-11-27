/**
 * Instagram Provider (ENRICH--T04-AC04)
 *
 * Fallback provider for Instagram post metadata extraction.
 */

import { createLogger } from '#utils/logger'
import type { LinkContext, Provider } from './types.js'
import { URL_PATTERNS } from './types.js'

const logger = createLogger('enrich:instagram-provider')

/**
 * AC04: Instagram Provider (social media fallback)
 */
export class InstagramProvider implements Provider {
	name = 'instagram'
	priority = 4

	detect(url: string): boolean {
		return URL_PATTERNS.instagram.test(url)
	}

	async extract(url: string): Promise<LinkContext> {
		try {
			// Extract post ID from URL
			const postIdMatch = url.match(/\/p\/([A-Za-z0-9_-]+)/)
			const postId = postIdMatch?.[1]

			if (!postId) {
				throw new Error('Could not extract Instagram post ID')
			}

			// In production, would parse meta tags or use Instagram API
			const title = `Instagram Post: ${postId}`

			logger.debug(`Instagram extracted metadata for ${url}`)
			return {
				url,
				title,
				description: 'Post from Instagram',
				provider: 'instagram',
				usedFallback: true,
			}
		} catch (error) {
			logger.error(`Instagram extraction failed for ${url}`, { error })
			throw error
		}
	}
}
