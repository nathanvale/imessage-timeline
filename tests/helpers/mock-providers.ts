/**
 * Mock Provider Setup Utilities (CI-T04-AC02)
 *
 * Utilities for mocking AI services (Gemini, Firecrawl) in tests.
 * Provides consistent mocks across test suites with realistic responses.
 */

import { vi } from 'vitest'

// ============================================================================
// Type Definitions
// ============================================================================

export type MockImageAnalysisResult = {
	visionSummary: string
	shortDescription: string
	provider: 'gemini'
	model: string
	version: string
	createdAt: string
}

export type MockTranscriptionResult = {
	fullTranscription: string
	shortDescription: string
	speakers?: string[]
	timestamps?: string[]
	provider: 'gemini'
	model: string
}

export type MockLinkContextResult = {
	title: string
	summary: string
	url: string
	provider: 'firecrawl' | 'youtube' | 'spotify' | 'twitter' | 'instagram'
}

export type MockPdfSummaryResult = {
	summary: string
	pageCount: number
	provider: 'gemini'
}

// ============================================================================
// Mock Provider Factories
// ============================================================================

/**
 * Creates a mock Gemini Vision API client for image analysis
 *
 * @example
 * const mockGemini = createMockGeminiVision()
 * mockGemini.mockResolvedValueOnce({
 *   visionSummary: 'A photo of a sunset',
 *   shortDescription: 'Sunset photo'
 * })
 */
export function createMockGeminiVision() {
	return vi.fn(async (imagePath: string): Promise<MockImageAnalysisResult> => {
		const filename = imagePath.split('/').pop() || 'image.jpg'
		return {
			visionSummary: `Mock detailed analysis of ${filename}`,
			shortDescription: `Mock caption for ${filename}`,
			provider: 'gemini',
			model: 'gemini-1.5-pro',
			version: '2025-10-17',
			createdAt: new Date().toISOString(),
		}
	})
}

/**
 * Creates a mock Gemini Audio API client for transcription
 *
 * @example
 * const mockAudio = createMockGeminiAudio()
 * mockAudio.mockResolvedValueOnce({
 *   fullTranscription: 'Hello, this is a test',
 *   shortDescription: 'Test audio message'
 * })
 */
export function createMockGeminiAudio() {
	return vi.fn(async (audioPath: string): Promise<MockTranscriptionResult> => {
		const filename = audioPath.split('/').pop() || 'audio.m4a'
		return {
			fullTranscription: `Mock transcription for ${filename}`,
			shortDescription: `Mock audio summary for ${filename}`,
			speakers: ['Speaker 1', 'Speaker 2'],
			timestamps: ['00:00', '00:15', '00:30'],
			provider: 'gemini',
			model: 'gemini-1.5-pro',
		}
	})
}

/**
 * Creates a mock Gemini PDF API client for summarization
 *
 * @example
 * const mockPdf = createMockGeminiPdf()
 * mockPdf.mockResolvedValueOnce({
 *   summary: 'This PDF contains...',
 *   pageCount: 5
 * })
 */
export function createMockGeminiPdf() {
	return vi.fn(async (pdfPath: string): Promise<MockPdfSummaryResult> => {
		const filename = pdfPath.split('/').pop() || 'document.pdf'
		return {
			summary: `Mock PDF summary for ${filename}`,
			pageCount: 10,
			provider: 'gemini',
		}
	})
}

/**
 * Creates a mock Firecrawl API client for link context extraction
 *
 * @example
 * const mockFirecrawl = createMockFirecrawl()
 * mockFirecrawl.mockResolvedValueOnce({
 *   title: 'Example Article',
 *   summary: 'This article discusses...'
 * })
 */
export function createMockFirecrawl() {
	return vi.fn(async (url: string): Promise<MockLinkContextResult> => {
		return {
			title: `Mock title for ${url}`,
			summary: `Mock summary extracted from ${url}`,
			url,
			provider: 'firecrawl',
		}
	})
}

/**
 * Creates a mock YouTube metadata extractor
 *
 * @example
 * const mockYouTube = createMockYouTube()
 * mockYouTube.mockResolvedValueOnce({
 *   title: 'Cool Video',
 *   summary: 'Channel: Example Channel'
 * })
 */
export function createMockYouTube() {
	return vi.fn(async (url: string): Promise<MockLinkContextResult> => {
		return {
			title: 'Mock YouTube Video Title',
			summary: 'Mock Channel: Test Channel | 1.2M views',
			url,
			provider: 'youtube',
		}
	})
}

/**
 * Creates a mock Spotify metadata extractor
 *
 * @example
 * const mockSpotify = createMockSpotify()
 * mockSpotify.mockResolvedValueOnce({
 *   title: 'Great Song',
 *   summary: 'Artist: Amazing Artist'
 * })
 */
export function createMockSpotify() {
	return vi.fn(async (url: string): Promise<MockLinkContextResult> => {
		return {
			title: 'Mock Track Name',
			summary: 'Mock Artist: Test Artist | Album: Test Album',
			url,
			provider: 'spotify',
		}
	})
}

/**
 * Creates a mock Twitter/X metadata extractor
 *
 * @example
 * const mockTwitter = createMockTwitter()
 */
export function createMockTwitter() {
	return vi.fn(async (url: string): Promise<MockLinkContextResult> => {
		return {
			title: 'Tweet by @testuser',
			summary: 'Mock tweet content goes here...',
			url,
			provider: 'twitter',
		}
	})
}

/**
 * Creates a mock Instagram metadata extractor
 *
 * @example
 * const mockInstagram = createMockInstagram()
 */
export function createMockInstagram() {
	return vi.fn(async (url: string): Promise<MockLinkContextResult> => {
		return {
			title: 'Post by @testuser',
			summary: 'Mock Instagram caption text...',
			url,
			provider: 'instagram',
		}
	})
}

// ============================================================================
// Composite Mock Setups
// ============================================================================

/**
 * Creates a full suite of mocked AI providers for comprehensive testing
 *
 * @example
 * const mocks = createMockProviderSuite()
 * // Use mocks.geminiVision, mocks.firecrawl, etc. in your tests
 */
export function createMockProviderSuite() {
	return {
		geminiVision: createMockGeminiVision(),
		geminiAudio: createMockGeminiAudio(),
		geminiPdf: createMockGeminiPdf(),
		firecrawl: createMockFirecrawl(),
		youtube: createMockYouTube(),
		spotify: createMockSpotify(),
		twitter: createMockTwitter(),
		instagram: createMockInstagram(),
	}
}

/**
 * Sets up all mocks to fail (for testing error handling)
 *
 * @example
 * const mocks = createMockProviderSuite()
 * setupMockFailures(mocks, 'Rate limited')
 */
export function setupMockFailures(
	mocks: ReturnType<typeof createMockProviderSuite>,
	errorMessage = 'Mock API failure',
) {
	Object.values(mocks).forEach((mock) => {
		mock.mockRejectedValue(new Error(errorMessage))
	})
}

/**
 * Resets all mock call histories
 *
 * @example
 * const mocks = createMockProviderSuite()
 * resetAllMocks(mocks)
 */
export function resetAllMocks(
	mocks: ReturnType<typeof createMockProviderSuite>,
) {
	Object.values(mocks).forEach((mock) => {
		mock.mockClear()
	})
}
