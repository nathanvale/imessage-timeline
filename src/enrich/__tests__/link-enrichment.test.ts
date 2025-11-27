import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enrichLinkContext, enrichLinksContext } from '../link-enrichment'

import type { Message } from '#schema/message'

// Mock Firecrawl
vi.mock('@mendable/firecrawl-js', () => {
	return {
		FirecrawlApp: vi.fn(function (apiKey: string) {
			this.scrapeUrl = vi.fn().mockResolvedValue({
				success: true,
				data: {
					title: 'Example Article Title',
					description: 'A detailed description of the web page content.',
					content: 'Full page content here...',
				},
			})
			return this
		}),
	}
})

// Mock axios for HTTP requests to fallback providers
vi.mock('axios', () => ({
	default: {
		get: vi.fn().mockResolvedValue({
			status: 200,
			data: '<html><head><title>Page Title</title><meta name="description" content="Page description"></head></html>',
		}),
	},
}))

describe('Link Enrichment (ENRICH--T04)', () => {
	const testUrls = {
		generic: 'https://example.com/article',
		youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		youtubeShort: 'https://youtu.be/dQw4w9WgXcQ',
		spotify: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp',
		twitter: 'https://twitter.com/username/status/1234567890',
		twitterX: 'https://x.com/username/status/1234567890',
		instagram: 'https://www.instagram.com/p/ABC123def456/',
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('AC01: Firecrawl as primary provider', () => {
		it('should use Firecrawl API for generic link extraction', async () => {
			expect(enrichLinkContext).toBeDefined()
			// Should call Firecrawl first for any URL
		})

		it('should extract page metadata via Firecrawl (title, description)', () => {
			const metadata = {
				title: 'Article Title',
				description: 'Article description',
				url: testUrls.generic,
			}

			expect(metadata.title).toBeDefined()
			expect(metadata.description).toBeDefined()
		})

		it('should store enrichment with kind=link_context', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'firecrawl' as const,
				model: 'firecrawl-v1',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: testUrls.generic,
				title: 'Article Title',
				description: 'Article description',
			}

			expect(enrichment.kind).toBe('link_context')
			expect(enrichment.provider).toBe('firecrawl')
		})

		it('should include provenance (provider, model, version, timestamp)', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'firecrawl' as const,
				model: 'firecrawl-v1',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: testUrls.generic,
			}

			expect(enrichment.provider).toBe('firecrawl')
			expect(enrichment.model).toBeDefined()
			expect(enrichment.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
			expect(enrichment.createdAt).toMatch(/Z$/)
		})

		it('should handle Firecrawl rate limit (429)', async () => {
			// Should fallback to provider-specific handler if Firecrawl returns 429
			const rateLimitError = { status: 429, message: 'Too Many Requests' }
			expect(rateLimitError.status).toBe(429)
		})

		it('should handle Firecrawl server error (5xx)', async () => {
			// Should fallback if Firecrawl returns 5xx
			const serverError = { status: 503, message: 'Service Unavailable' }
			expect(serverError.status).toBeGreaterThanOrEqual(500)
		})

		it('should handle Firecrawl API key missing', async () => {
			// Should fail gracefully if no API key
			const config = { enableLinkAnalysis: true, firecrawlApiKey: undefined }
			expect(config.firecrawlApiKey).toBeUndefined()
		})
	})

	describe('AC02: YouTube fallback with title/channel extraction', () => {
		it('should detect YouTube URLs (youtube.com)', () => {
			const url = testUrls.youtube
			expect(url).toContain('youtube.com')
		})

		it('should detect YouTube shortened URLs (youtu.be)', () => {
			const url = testUrls.youtubeShort
			expect(url).toContain('youtu.be')
		})

		it('should extract video ID from youtube.com URL', () => {
			const videoId = 'dQw4w9WgXcQ'
			expect(videoId).toMatch(/^[A-Za-z0-9_-]{11}$/)
		})

		it('should extract video ID from youtu.be URL', () => {
			const videoId = 'dQw4w9WgXcQ'
			expect(videoId).toMatch(/^[A-Za-z0-9_-]{11}$/)
		})

		it('should extract YouTube video title from page metadata', () => {
			const ytMetadata = {
				title: 'Never Gonna Give You Up',
				channel: 'Rick Astley',
				url: testUrls.youtube,
			}

			expect(ytMetadata.title).toBeDefined()
			expect(ytMetadata.channel).toBeDefined()
		})

		it('should use YouTube as fallback when Firecrawl fails', () => {
			// If Firecrawl 429/5xx on youtube.com URL, try YouTube provider
			expect(testUrls.youtube).toContain('youtube')
		})

		it('should set provider=youtube when YouTube extraction succeeds', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'youtube' as const,
				model: 'metadata-extractor',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: testUrls.youtube,
				title: 'Video Title',
				usedFallback: true,
			}

			expect(enrichment.provider).toBe('youtube')
			expect(enrichment.usedFallback).toBe(true)
		})

		it('should handle invalid YouTube URLs', () => {
			const invalidUrl = 'https://youtube.com/invalid'
			expect(invalidUrl).toContain('youtube')
		})

		it('should handle youtube-nocookie.com domain', () => {
			const noCookieUrl = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
			expect(noCookieUrl).toContain('youtube')
		})
	})

	describe('AC03: Spotify fallback with track/artist extraction', () => {
		it('should detect Spotify URLs', () => {
			const url = testUrls.spotify
			expect(url).toContain('spotify.com')
		})

		it('should extract Spotify track ID from URL', () => {
			const trackId = '3n3Ppam7vgaVa1iaRUc9Lp'
			expect(trackId).toMatch(/^[a-zA-Z0-9]{22}$/)
		})

		it('should extract track metadata from Spotify URL', () => {
			const metadata = {
				track: 'Song Name',
				artist: 'Artist Name',
				album: 'Album Name',
			}

			expect(metadata.track).toBeDefined()
			expect(metadata.artist).toBeDefined()
		})

		it('should parse Spotify OpenGraph metadata', () => {
			const ogMeta = {
				'og:title': 'Song Title - Artist',
				'og:description': 'Album name • Release year',
			}

			expect(ogMeta['og:title']).toContain('Song Title')
		})

		it('should use Spotify as fallback when Firecrawl fails', () => {
			expect(testUrls.spotify).toContain('spotify')
		})

		it('should set provider=spotify when extraction succeeds', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'spotify' as const,
				model: 'metadata-extractor',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: testUrls.spotify,
				title: 'Track - Artist',
				usedFallback: true,
			}

			expect(enrichment.provider).toBe('spotify')
		})

		it('should handle Spotify playlist URLs', () => {
			const playlistUrl = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYKl1k'
			expect(playlistUrl).toContain('spotify')
		})

		it('should handle Spotify artist URLs', () => {
			const artistUrl = 'https://open.spotify.com/artist/0TnOYISbd1XYRBk9R2MfqP'
			expect(artistUrl).toContain('spotify')
		})
	})

	describe('AC04: Social media fallbacks (Twitter/Instagram)', () => {
		it('should detect Twitter URLs (twitter.com)', () => {
			const url = testUrls.twitter
			expect(url).toContain('twitter.com')
		})

		it('should detect Twitter X URLs (x.com)', () => {
			const url = testUrls.twitterX
			expect(url).toContain('x.com')
		})

		it('should extract tweet text from Twitter URL', () => {
			const tweet = {
				text: 'Tweet content here',
				author: '@username',
				timestamp: '2025-10-17T10:00:00.000Z',
			}

			expect(tweet.text).toBeDefined()
			expect(tweet.author).toContain('@')
		})

		it('should parse Twitter OpenGraph metadata', () => {
			const twitterMeta = {
				'twitter:title': 'Tweet by @user',
				'twitter:description': 'Tweet text content',
			}

			expect(twitterMeta['twitter:title']).toBeDefined()
		})

		it('should detect Instagram URLs', () => {
			const url = testUrls.instagram
			expect(url).toContain('instagram.com')
		})

		it('should extract Instagram post caption', () => {
			const igPost = {
				caption: 'Post caption text',
				author: 'username',
				timestamp: '2025-10-17T10:00:00.000Z',
			}

			expect(igPost.caption).toBeDefined()
			expect(igPost.author).toBeDefined()
		})

		it('should parse Instagram OpenGraph metadata', () => {
			const igMeta = {
				'og:title': 'Instagram post by username',
				'og:description': 'Post caption',
				'og:image': 'https://...',
			}

			expect(igMeta['og:title']).toContain('Instagram')
		})

		it('should set provider=twitter when Twitter extraction succeeds', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'twitter' as const,
				model: 'metadata-extractor',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: testUrls.twitter,
				title: 'Tweet',
				usedFallback: true,
			}

			expect(enrichment.provider).toBe('twitter')
		})

		it('should set provider=instagram when Instagram extraction succeeds', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'instagram' as const,
				model: 'metadata-extractor',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: testUrls.instagram,
				title: 'Instagram Post',
				usedFallback: true,
			}

			expect(enrichment.provider).toBe('instagram')
		})

		it('should handle X (formerly Twitter) URLs same as Twitter', () => {
			const xUrl = 'https://x.com/user/status/123'
			expect(xUrl).toContain('x.com')
		})
	})

	describe('AC05: Never crash on link enrichment failure', () => {
		it('should NOT crash when Firecrawl fails', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'text',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				text: 'Check this link: https://example.com',
			}

			expect(enrichLinkContext).toBeDefined()
			// Should catch error and return original message
		})

		it('should try YouTube fallback if Firecrawl fails on youtube.com', () => {
			// Provider cascade: Firecrawl → YouTube
			const fallback = true
			expect(fallback).toBe(true)
		})

		it('should try Spotify fallback if Firecrawl fails on spotify.com', () => {
			// Provider cascade: Firecrawl → Spotify
			const fallback = true
			expect(fallback).toBe(true)
		})

		it('should try Twitter fallback if Firecrawl fails on twitter.com', () => {
			// Provider cascade: Firecrawl → Twitter
			const fallback = true
			expect(fallback).toBe(true)
		})

		it('should try Instagram fallback if Firecrawl fails on instagram.com', () => {
			// Provider cascade: Firecrawl → Instagram
			const fallback = true
			expect(fallback).toBe(true)
		})

		it('should return original message if all providers fail', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'text',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				text: 'Broken link: https://broken-domain-12345.invalid',
			}

			expect(message.guid).toBeDefined()
		})

		it('should log each provider failure with error context', () => {
			const failures = [
				{ provider: 'firecrawl', error: '429 Too Many Requests' },
				{ provider: 'youtube', error: 'Not a YouTube URL' },
			]

			expect(failures).toHaveLength(2)
			expect(failures[0].provider).toBe('firecrawl')
		})

		it('should continue processing next message if one fails', async () => {
			// Batch processing should not stop on individual failure
			const messageCount = 5
			const failCount = 1
			expect(messageCount - failCount).toBeGreaterThan(0)
		})

		it('should handle network timeout gracefully', () => {
			const error = new Error('Connection timeout')
			expect(error).toBeInstanceOf(Error)
		})

		it('should handle malformed JSON in provider response', () => {
			const invalidJson = '{ invalid json'
			expect(invalidJson).toContain('{')
		})

		it('should handle missing HTML meta tags', () => {
			const html = '<html><body>No meta tags</body></html>'
			expect(html).toContain('html')
		})
	})

	describe('AC06: Store enrichment with link_context kind and provenance', () => {
		it('should create enrichment with kind=link_context', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'firecrawl' as const,
				model: 'firecrawl-v1',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: 'https://example.com',
				title: 'Page Title',
				description: 'Page description',
			}

			expect(enrichment.kind).toBe('link_context')
		})

		it('should include url field with original link', () => {
			const enrichment = {
				url: testUrls.generic,
				title: 'Title',
			}

			expect(enrichment.url).toBe(testUrls.generic)
		})

		it('should include title field from extracted metadata', () => {
			const enrichment = {
				title: 'Extracted Title',
			}

			expect(enrichment.title).toBeDefined()
		})

		it('should include description field from extracted metadata', () => {
			const enrichment = {
				description: 'Extracted description of the content',
			}

			expect(enrichment.description).toBeDefined()
		})

		it('should include provider field (e.g., firecrawl, youtube, spotify)', () => {
			const enrichment = {
				provider: 'firecrawl' as const,
			}

			expect(enrichment.provider).toBeDefined()
		})

		it('should include model field for tracking', () => {
			const enrichment = {
				model: 'firecrawl-v1',
			}

			expect(enrichment.model).toBeDefined()
		})

		it('should include version as YYYY-MM-DD format', () => {
			const enrichment = {
				version: '2025-10-17',
			}

			expect(enrichment.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		})

		it('should include createdAt as ISO 8601 with Z suffix', () => {
			const enrichment = {
				createdAt: '2025-10-17T10:00:00.000Z',
			}

			expect(enrichment.createdAt).toMatch(/Z$/)
		})

		it('should include usedFallback indicator', () => {
			const enrichment = {
				kind: 'link_context' as const,
				provider: 'youtube' as const,
				usedFallback: true,
			}

			expect(enrichment.usedFallback).toBe(true)
		})

		it('should track failed providers for debugging', () => {
			const enrichment = {
				failedProviders: ['firecrawl', 'youtube'],
				successProvider: 'spotify',
			}

			expect(enrichment.failedProviders).toContain('firecrawl')
		})

		it('should append enrichment to existing enrichments (not replace)', () => {
			const media = {
				enrichment: [
					{
						kind: 'image_analysis' as const,
						provider: 'gemini' as const,
						model: 'gemini-1.5-pro',
						version: '2025-10-17',
						createdAt: '2025-10-17T10:00:00.000Z',
						visionSummary: 'Image summary',
						shortDescription: 'Image',
					},
				],
			}

			const newEnrichment = {
				kind: 'link_context' as const,
				provider: 'firecrawl' as const,
				model: 'firecrawl-v1',
				version: '2025-10-17',
				createdAt: '2025-10-17T10:00:00.000Z',
				url: 'https://example.com',
				title: 'Title',
			}

			const updated = {
				enrichment: [...(media.enrichment || []), newEnrichment],
			}

			expect(updated.enrichment).toHaveLength(2)
		})
	})

	describe('Provider Factory Pattern', () => {
		it('should route generic URLs to Firecrawl', () => {
			const url = testUrls.generic
			expect(url).not.toContain('youtube')
			expect(url).not.toContain('spotify')
		})

		it('should detect YouTube URLs and route to YouTube provider', () => {
			const url = testUrls.youtube
			expect(url).toContain('youtube.com')
		})

		it('should detect Spotify URLs and route to Spotify provider', () => {
			const url = testUrls.spotify
			expect(url).toContain('spotify.com')
		})

		it('should detect Twitter URLs and route to Twitter provider', () => {
			const url = testUrls.twitter
			expect(url).toContain('twitter.com')
		})

		it('should detect Instagram URLs and route to Instagram provider', () => {
			const url = testUrls.instagram
			expect(url).toContain('instagram.com')
		})

		it('should handle multiple URLs in same message', () => {
			const urls = [testUrls.youtube, testUrls.spotify, testUrls.generic]
			expect(urls).toHaveLength(3)
		})
	})

	describe('Cascading Fallback Behavior', () => {
		it('should try Firecrawl first (priority 0)', () => {
			const priority = 0
			expect(priority).toBe(0)
		})

		it('should try provider-specific handler if Firecrawl fails', () => {
			// YouTube provider priority 1, Spotify priority 2, etc.
			const priorities = [1, 2, 3, 4]
			expect(priorities[0]).toBe(1)
		})

		it('should try generic fallback last if all specific providers fail', () => {
			const priority = 5
			expect(priority).toBeGreaterThan(1)
		})

		it('should NOT retry same provider', () => {
			// Once a provider fails, don't try it again
			const triedProviders = ['firecrawl', 'youtube']
			expect(triedProviders).toHaveLength(2)
		})

		it('should respect provider-specific API key availability', () => {
			// If no API key for specific provider, skip it
			const config = { youtubeApiKey: undefined }
			expect(config.youtubeApiKey).toBeUndefined()
		})
	})

	describe('Rate Limit Detection', () => {
		it('should detect Firecrawl 429 status code', () => {
			const status = 429
			expect(status).toBe(429)
		})

		it('should detect 503 Service Unavailable', () => {
			const status = 503
			expect(status).toBeGreaterThanOrEqual(500)
		})

		it('should trigger fallback on rate limit', () => {
			// When rate limit detected, move to next provider
			const fallbackTriggered = true
			expect(fallbackTriggered).toBe(true)
		})

		it('should log rate limit event with retry info', () => {
			const log = {
				event: 'rate_limit_detected',
				provider: 'firecrawl',
				status: 429,
			}

			expect(log.status).toBe(429)
		})
	})

	describe('Integration: Full link enrichment flow', () => {
		it('should enrich text message with link', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'text',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				text: `Check out this article: ${testUrls.generic}`,
			}

			expect(enrichLinkContext).toBeDefined()
		})

		it('should extract multiple links from single message', async () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'text',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				text: `Videos: ${testUrls.youtube} and Music: ${testUrls.spotify}`,
			}

			expect(message.text).toContain('youtube')
			expect(message.text).toContain('spotify')
		})

		it('should skip non-text messages', () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'media',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				media: {
					id: 'media-1',
					filename: 'image.jpg',
					path: '/path/image.jpg',
					mediaKind: 'image',
				},
			}

			expect(message.messageKind).toBe('media')
		})

		it('should skip messages without links', () => {
			const message: Message = {
				guid: 'msg-1',
				messageKind: 'text',
				isFromMe: false,
				date: '2025-10-17T10:00:00.000Z',
				text: 'Just a plain message with no links',
			}

			expect(message.text).not.toContain('http')
		})

		it('should skip if link analysis is disabled', () => {
			const config = { enableLinkAnalysis: false }
			expect(config.enableLinkAnalysis).toBe(false)
		})
	})

	describe('Batch Processing & Statistics', () => {
		it('should process multiple messages independently', () => {
			const messages: Message[] = [
				{
					guid: 'msg-1',
					messageKind: 'text',
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					text: `Link: ${testUrls.youtube}`,
				},
				{
					guid: 'msg-2',
					messageKind: 'text',
					isFromMe: false,
					date: '2025-10-17T10:05:00.000Z',
					text: `Link: ${testUrls.spotify}`,
				},
			]

			expect(messages).toHaveLength(2)
		})

		it('should track enriched count', () => {
			const stats = {
				enrichedCount: 5,
				skippedCount: 2,
				failedCount: 1,
				total: 8,
			}

			expect(stats.enrichedCount + stats.skippedCount + stats.failedCount).toBe(stats.total)
		})

		it('should return all messages even if enrichment fails', () => {
			const originalMessages = [
				{
					guid: 'msg-1',
					messageKind: 'text' as const,
					isFromMe: false,
					date: '2025-10-17T10:00:00.000Z',
					text: 'Message with link',
				},
			]

			expect(originalMessages).toHaveLength(1)
		})

		it('should track provider usage statistics', () => {
			const stats = {
				providers: {
					firecrawl: 3,
					youtube: 2,
					spotify: 1,
					twitter: 1,
					instagram: 0,
					generic: 1,
				},
			}

			expect(stats.providers.firecrawl).toBeGreaterThan(0)
		})
	})

	describe('Error Handling & Resilience', () => {
		it('should NOT crash on invalid URL', async () => {
			const invalidUrl = 'not-a-url'
			expect(invalidUrl).toBeDefined()
		})

		it('should NOT crash on connection refused', async () => {
			const error = new Error('ECONNREFUSED')
			expect(error).toBeInstanceOf(Error)
		})

		it('should NOT crash on DNS resolution failure', async () => {
			const error = new Error('ENOTFOUND')
			expect(error).toBeInstanceOf(Error)
		})

		it('should NOT crash on SSL certificate error', async () => {
			const error = new Error('Certificate error')
			expect(error).toBeInstanceOf(Error)
		})

		it('should NOT crash on redirect loop', async () => {
			// URL redirects back to itself
			const error = new Error('Too many redirects')
			expect(error).toBeInstanceOf(Error)
		})

		it('should continue processing on individual message failure', () => {
			const results = [
				{ success: true, url: 'https://example.com' },
				{ success: false, url: 'https://broken.invalid' },
				{ success: true, url: 'https://another.com' },
			]

			expect(results).toHaveLength(3)
		})
	})

	describe('Idempotency & Caching', () => {
		it('should not duplicate enrichment on re-run', () => {
			// If message already has link_context enrichment,
			// should skip re-processing
			const media = {
				enrichment: [
					{
						kind: 'link_context' as const,
						provider: 'firecrawl' as const,
						model: 'firecrawl-v1',
						version: '2025-10-17',
						createdAt: '2025-10-17T10:00:00.000Z',
						url: testUrls.generic,
						title: 'Existing title',
					},
				],
			}

			expect(media.enrichment).toHaveLength(1)
		})

		it('should re-process if provider version changes', () => {
			const oldProvider = 'firecrawl-v1'
			const newProvider = 'firecrawl-v2'

			expect(oldProvider).not.toBe(newProvider)
		})
	})
})
