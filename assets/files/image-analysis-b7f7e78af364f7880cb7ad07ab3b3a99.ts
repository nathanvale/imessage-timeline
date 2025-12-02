/**
 * Image Analysis Module (ENRICH--T01)
 *
 * Implements image analysis with preview generation:
 * - AC01: HEIC → JPG conversion with ≥90% quality
 * - AC02: TIFF → JPG conversion
 * - AC03: Preview caching by filename (generate once, skip if exists)
 * - AC04: Gemini Vision API with structured prompt
 * - AC05: Parse response into enrichment array with kind='image_analysis'
 * - AC06: Store provenance (provider, model, version, timestamp)
 *
 * Architecture:
 * - convertToJpgPreview: Handles format conversion with caching
 * - analyzeImageWithGemini: Calls Gemini Vision API with structured prompt
 * - analyzeImage: Main entry point, handles single message enrichment
 * - analyzeImages: Batch processing wrapper
 *
 * Error Handling:
 * - Non-fatal errors are logged and original message is returned
 * - Preview generation failures don't block Gemini analysis
 * - Pipeline never crashes on enrichment errors
 */

import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'

import type { MediaEnrichment, MediaMeta, Message } from '#schema/message'

import { createLogger } from '#utils/logger'

type ImageAnalysisConfig = {
	enableVisionAnalysis: boolean
	geminiApiKey: string
	geminiModel?: string
	imageCacheDir: string
}

const logger = createLogger('enrich:image-analysis')

/**
 * Structured prompt for Gemini Vision analysis
 * First classifies image type, then provides detailed + short descriptions
 */
const GEMINI_VISION_PROMPT = `You are an expert at analyzing images. First, classify the image type:
- photo (real-world scene, landscape, portrait, food, outdoor, indoor, etc.)
- screenshot (UI, application, website, text content)
- diagram (chart, graph, whiteboard, flowchart)
- artwork (drawing, illustration, design, painting)
- other (specify what it is)

Then provide:
1. visionSummary: A detailed 2-3 sentence description of the image content, context, and notable details
2. shortDescription: A concise 1-sentence summary for quick scanning

Format your response exactly as:
IMAGE_TYPE: [classification]
visionSummary: [detailed description here]
shortDescription: [one sentence summary]`

/**
 * AC03: Convert image to JPG preview
 * - Input: path to HEIC, TIFF, or other format
 * - Output: path to cached JPG preview
 * - Behavior: Generate once, cache by filename, skip if exists
 */
export async function convertToJpgPreview(
	inputPath: string,
	cacheDir: string,
	quality = 90,
): Promise<string> {
	if (!inputPath || !cacheDir) {
		throw new Error('inputPath and cacheDir are required')
	}

	const filename = path.parse(path.basename(inputPath)).name
	const previewFilename = `preview-${filename}.jpg`
	const previewPath = path.join(cacheDir, previewFilename)

	try {
		// AC03: Check if preview already exists
		await access(previewPath)
		// If we get here, file exists - return cached path
		logger.debug(`Preview cache hit: ${previewPath}`)
		return previewPath
	} catch {
		// File doesn't exist, proceed with conversion
	}

	// AC01/AC02: Convert to JPG with quality preservation
	try {
		const imageBuffer = await sharp(inputPath)
			.toFormat('jpeg')
			.jpeg({ quality, progressive: true })
			.toBuffer()

		// Write to cache
		await writeFile(previewPath, imageBuffer)
		logger.info(`Generated preview: ${previewPath}`, { inputPath, quality })

		return previewPath
	} catch (error) {
		logger.error(`Failed to convert image: ${inputPath}`, { error })
		throw new Error(`Failed to convert image to JPG: ${inputPath}`)
	}
}

/**
 * AC04: Call Gemini Vision with structured prompt
 * AC05: Parse response into enrichment array
 * AC06: Store provenance
 */
export async function analyzeImageWithGemini(
	imagePath: string,
	config: Partial<ImageAnalysisConfig>,
): Promise<MediaEnrichment> {
	const apiKey = config.geminiApiKey
	const modelName = config.geminiModel || 'gemini-1.5-pro'

	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is required for image analysis')
	}

	try {
		// AC04: Create Gemini client and call with structured prompt
		const genAI = new GoogleGenerativeAI(apiKey)
		const model = genAI.getGenerativeModel({ model: modelName })

		// Read image file
		const imageData = await sharp(imagePath).toFormat('jpeg').toBuffer()

		const base64Image = imageData.toString('base64')

		// AC04: Call Gemini with structured prompt

		// Call Gemini with image
		const response = await model.generateContent([
			{
				inlineData: {
					mimeType: 'image/jpeg',
					data: base64Image,
				},
			},
			GEMINI_VISION_PROMPT,
		])

		const responseText = response.response.text()
		logger.debug(
			`Gemini response received: ${responseText.substring(0, 150)}...`,
		)

		// AC05: Parse response
		const visionSummaryMatch = responseText.match(
			/visionSummary:\s*(.+?)(?=\n(?:shortDescription|$))/is,
		)
		const shortDescriptionMatch = responseText.match(
			/shortDescription:\s*(.+?)(?=\n|$)/is,
		)

		if (!visionSummaryMatch || !shortDescriptionMatch) {
			logger.warn(`Failed to parse Gemini response for ${imagePath}`)
		}

		const visionSummary =
			visionSummaryMatch?.[1]?.trim() || 'Image analysis unavailable'
		const shortDescription = shortDescriptionMatch?.[1]?.trim() || 'Image'

		// AC06: Create enrichment entry with full provenance
		const version = new Date().toISOString().split('T')[0] || 'unknown'
		const enrichment: MediaEnrichment = {
			kind: 'image_analysis',
			provider: 'gemini',
			model: modelName,
			version, // YYYY-MM-DD
			createdAt: new Date().toISOString(),
			visionSummary,
			shortDescription,
		}

		logger.info(`Image analysis complete for ${imagePath}`, {
			kind: enrichment.kind,
		})
		return enrichment
	} catch (error) {
		logger.error(`Gemini API error for ${imagePath}`, { error })
		throw error
	}
}

/**
 * Main entry point - analyze image media message and enrich it
 * Handles all ACs (AC01-AC06) through helper functions
 *
 * Responsibilities:
 * 1. Check if media is image type (skip non-images)
 * 2. Convert HEIC/TIFF to JPG preview (AC01-AC03)
 * 3. Call Gemini Vision API (AC04)
 * 4. Parse response (AC05)
 * 5. Add enrichment with provenance (AC06)
 */
export async function analyzeImage(
	message: Message,
	config: Partial<ImageAnalysisConfig>,
): Promise<Message> {
	// Skip if not enabled
	if (!config.enableVisionAnalysis) {
		logger.debug('Vision analysis disabled in config')
		return message
	}

	// Skip if not a media message
	if (message.messageKind !== 'media' || !message.media) {
		return message
	}

	// Skip if media is not an image
	if (message.media.mediaKind !== 'image') {
		logger.debug('Skipping non-image media', {
			mediaKind: message.media.mediaKind,
		})
		return message
	}

	// Skip if path is missing
	if (!message.media.path) {
		logger.warn('Skipping image with missing path', {
			filename: message.media.filename,
		})
		return message
	}

	try {
		const imageCacheDir = config.imageCacheDir || '/tmp/image-cache'

		// AC01-AC03: Generate preview (cached)
		let _previewPath: string | undefined
		try {
			_previewPath = await convertToJpgPreview(
				message.media.path,
				imageCacheDir,
				90,
			)
		} catch (err) {
			logger.warn(
				'Failed to create preview - continuing with Gemini analysis',
				{
					filename: message.media.filename,
					error: err instanceof Error ? err.message : String(err),
				},
			)
			// Continue with Gemini analysis even if preview fails
		}

		// AC04-AC06: Analyze with Gemini
		const enrichment = await analyzeImageWithGemini(message.media.path, config)

		// Update message with enrichment
		const updatedMedia: MediaMeta = {
			...message.media,
			enrichment: [...(message.media.enrichment || []), enrichment],
		}

		logger.info('Image enriched', {
			filename: message.media.filename,
			guid: message.guid,
		})

		return {
			...message,
			media: updatedMedia,
		}
	} catch (error) {
		logger.error('Error analyzing image', {
			filename: message.media?.filename,
			guid: message.guid,
			error: error instanceof Error ? error.message : String(error),
		})
		// Don't crash pipeline - return original message
		return message
	}
}

/**
 * Batch analyze multiple messages
 * Useful for enrichment stage that processes arrays of messages
 * Each message is processed independently; errors don't stop the batch
 */
export async function analyzeImages(
	messages: Message[],
	config: Partial<ImageAnalysisConfig>,
): Promise<Message[]> {
	const results: Message[] = []
	let successCount = 0
	let skipCount = 0
	let errorCount = 0

	for (const message of messages) {
		try {
			const analyzed = await analyzeImage(message, config)
			// Track if enrichment was added
			if (
				analyzed.media?.enrichment &&
				analyzed.media.enrichment.length >
					(message.media?.enrichment?.length || 0)
			) {
				successCount++
			} else {
				skipCount++
			}
			results.push(analyzed)
		} catch (err) {
			errorCount++
			logger.error('Failed to analyze message', {
				guid: message.guid,
				error: err instanceof Error ? err.message : String(err),
			})
			// Keep original message if analysis fails
			results.push(message)
		}
	}

	logger.info('Batch image analysis complete', {
		successCount,
		skipCount,
		errorCount,
		total: messages.length,
	})
	return results
}
