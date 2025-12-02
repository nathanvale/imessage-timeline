/**
 * Generic Provider (ENRICH--T04-AC05)
 *
 * Generic fallback provider when all specialized providers fail.
 */

import { createLogger } from '#utils/logger'
import type { LinkContext, Provider } from './types.js'

const logger = createLogger('enrich:generic-provider')

/**
 * Generic fallback provider
 */
export class GenericProvider implements Provider {
	name = 'generic'
	priority = 5

	detect(_url: string): boolean {
		return true
	}

	async extract(url: string): Promise<LinkContext> {
		try {
			// Basic fallback - just use URL as title
			const title = new URL(url).hostname

			logger.debug(`Generic provider using fallback for ${url}`)
			return {
				url,
				title,
				description: 'Extracted via generic fallback',
				provider: 'generic',
				usedFallback: true,
			}
		} catch (error) {
			logger.error(`Generic extraction failed for ${url}`, { error })
			throw error
		}
	}
}
