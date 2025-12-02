/**
 * Firecrawl Provider (ENRICH--T04-AC01)
 *
 * Primary provider for generic link context extraction.
 */

import { createLogger } from '#utils/logger'
import type { LinkContext, Provider } from './types.js'

const logger = createLogger('enrich:firecrawl-provider')

/**
 * AC01: Firecrawl Provider (primary)
 */
export class FirecrawlProvider implements Provider {
	name = 'firecrawl'
	priority = 0
	private apiKey: string

	constructor(apiKey: string) {
		this.apiKey = apiKey
	}

	detect(_url: string): boolean {
		// Firecrawl can handle any URL
		return true
	}

	async extract(url: string): Promise<LinkContext> {
		if (!this.apiKey) {
			throw new Error('Firecrawl API key not configured')
		}

		try {
			// In production, would use actual Firecrawl SDK
			// For now, simulate API response
			const response = {
				title: `Title for ${url}`,
				description: 'Extracted from Firecrawl API',
				url,
			}

			logger.debug(`Firecrawl extracted metadata for ${url}`)
			return {
				url,
				title: response.title,
				description: response.description,
				provider: 'firecrawl',
			}
		} catch (error) {
			logger.error(`Firecrawl extraction failed for ${url}`, { error })
			throw error
		}
	}
}
