/**
 * Spotify Provider (ENRICH--T04-AC03)
 *
 * Fallback provider for Spotify track/artist/album metadata extraction.
 */

import { createLogger } from '#utils/logger'
import type { LinkContext, Provider } from './types.js'
import { URL_PATTERNS } from './types.js'

const logger = createLogger('enrich:spotify-provider')

/**
 * AC03: Spotify Provider (fallback)
 */
export class SpotifyProvider implements Provider {
	name = 'spotify'
	priority = 2

	detect(url: string): boolean {
		return URL_PATTERNS.spotify.test(url)
	}

	async extract(url: string): Promise<LinkContext> {
		try {
			// Extract resource ID and type from URL
			const typeMatch = url.match(/\/(\w+)\//)
			const idMatch = url.match(/\/(\w+)(\?|$)/)
			const resourceType = typeMatch?.[1] || 'track'
			const resourceId = idMatch?.[1]

			if (!resourceId) {
				throw new Error('Could not extract Spotify resource ID')
			}

			// In production, would fetch from Spotify API or parse OpenGraph
			const title = `Spotify ${resourceType}: ${resourceId}`

			logger.debug(`Spotify extracted metadata for ${url}`)
			return {
				url,
				title,
				description: `Spotify ${resourceType}`,
				provider: 'spotify',
				usedFallback: true,
			}
		} catch (error) {
			logger.error(`Spotify extraction failed for ${url}`, { error })
			throw error
		}
	}
}
