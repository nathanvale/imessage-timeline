/**
 * Tests for CONFIG--T01: Define Config Schema
 *
 * Validates:
 * - AC01: Config schema with Zod validation
 * - AC02: JSON and YAML format support (documented)
 * - AC03: Environment variable interpolation patterns
 * - AC04: Config file discovery
 * - AC05: Validation error formatting
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  ConfigSchema,
  validateConfig,
  validateConfigSafe,
  DEFAULT_CONFIG,
  CONFIG_FILE_PATTERNS,
  detectConfigFormat,
  type Config,
} from '../schema'

describe('ConfigSchema', () => {
  // CONFIG-T01-AC01: Basic schema validation
  describe('schema validation', () => {
    it('should validate minimal valid config', () => {
      const config = {
        gemini: {
          apiKey: 'test-api-key',
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('should validate full config with all fields', () => {
      const config: Config = {
        version: '1.0',
        attachmentRoots: [
          '~/Library/Messages/Attachments',
          '/Volumes/Backup/old-attachments',
        ],
        gemini: {
          apiKey: 'test-gemini-key',
          model: 'gemini-1.5-pro',
          rateLimitDelay: 1000,
          maxRetries: 3,
        },
        firecrawl: {
          apiKey: 'test-firecrawl-key',
          enabled: true,
        },
        enrichment: {
          enableVisionAnalysis: true,
          enableAudioTranscription: true,
          enableLinkEnrichment: true,
          imageCacheDir: './.cache/images',
          checkpointInterval: 100,
          forceRefresh: false,
        },
        render: {
          groupByTimeOfDay: true,
          renderRepliesAsNested: true,
          renderTapbacksAsEmoji: true,
          maxNestingDepth: 10,
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(config)
      }
    })

    it('should apply defaults for missing optional fields', () => {
      const config = {
        gemini: {
          apiKey: 'test-key',
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.version).toBe('1.0')
        expect(result.data.gemini.model).toBe('gemini-1.5-pro')
        expect(result.data.gemini.rateLimitDelay).toBe(1000)
        expect(result.data.gemini.maxRetries).toBe(3)
        expect(result.data.attachmentRoots).toEqual([
          '~/Library/Messages/Attachments',
        ])
        expect(result.data.enrichment.enableVisionAnalysis).toBe(true)
        expect(result.data.enrichment.checkpointInterval).toBe(100)
        expect(result.data.render.maxNestingDepth).toBe(10)
      }
    })

    it('should allow firecrawl to be optional', () => {
      const config = {
        gemini: {
          apiKey: 'test-key',
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.firecrawl).toBeUndefined()
      }
    })
  })

  // CONFIG-T01-AC01: Required field validation
  describe('required fields', () => {
    it('should require gemini.apiKey', () => {
      const config = {
        gemini: {
          apiKey: '',
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        const apiKeyError = result.error.errors.find((err) =>
          err.path.includes('apiKey')
        )
        expect(apiKeyError).toBeDefined()
        expect(apiKeyError?.message).toContain('required')
      }
    })

    it('should require at least one attachment root', () => {
      const config = {
        attachmentRoots: [],
        gemini: {
          apiKey: 'test-key',
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        const rootsError = result.error.errors.find((err) =>
          err.path.includes('attachmentRoots')
        )
        expect(rootsError).toBeDefined()
        expect(rootsError?.message).toContain('At least one')
      }
    })

    it('should reject empty attachment root paths', () => {
      const config = {
        attachmentRoots: [''],
        gemini: {
          apiKey: 'test-key',
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        const pathError = result.error.errors.find(
          (err) => err.path[0] === 'attachmentRoots'
        )
        expect(pathError).toBeDefined()
        expect(pathError?.message).toContain('cannot be empty')
      }
    })
  })

  // CONFIG-T01-AC01: Numeric constraints
  describe('numeric constraints', () => {
    it('should enforce rateLimitDelay >= 0', () => {
      const config = {
        gemini: {
          apiKey: 'test-key',
          rateLimitDelay: -100,
        },
      }

      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('should enforce maxRetries between 0 and 10', () => {
      const invalidConfig = {
        gemini: {
          apiKey: 'test-key',
          maxRetries: 15,
        },
      }

      const result = ConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it('should enforce checkpointInterval between 1 and 10000', () => {
      const tooLow = {
        gemini: { apiKey: 'test' },
        enrichment: { checkpointInterval: 0 },
      }

      expect(ConfigSchema.safeParse(tooLow).success).toBe(false)

      const tooHigh = {
        gemini: { apiKey: 'test' },
        enrichment: { checkpointInterval: 20000 },
      }

      expect(ConfigSchema.safeParse(tooHigh).success).toBe(false)
    })

    it('should enforce maxNestingDepth between 1 and 100', () => {
      const tooLow = {
        gemini: { apiKey: 'test' },
        render: { maxNestingDepth: 0 },
      }

      expect(ConfigSchema.safeParse(tooLow).success).toBe(false)

      const tooHigh = {
        gemini: { apiKey: 'test' },
        render: { maxNestingDepth: 150 },
      }

      expect(ConfigSchema.safeParse(tooHigh).success).toBe(false)
    })
  })

  // CONFIG-T01-AC05: Validation error formatting
  describe('validateConfig function', () => {
    it('should throw ZodError with field paths on invalid config', () => {
      const config = {
        gemini: {
          apiKey: '',
          maxRetries: 20,
        },
      }

      expect(() => validateConfig(config)).toThrow()

      try {
        validateConfig(config)
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError)
        if (error instanceof z.ZodError) {
          const errors = error.errors
          expect(errors.length).toBeGreaterThan(0)

          // Check that errors have field paths
          errors.forEach((err) => {
            expect(err.path).toBeDefined()
            expect(err.message).toBeDefined()
          })
        }
      }
    })

    it('should return valid config on success', () => {
      const config = {
        gemini: {
          apiKey: 'test-key',
        },
      }

      const result = validateConfig(config)
      expect(result).toBeDefined()
      expect(result.gemini.apiKey).toBe('test-key')
    })
  })

  describe('validateConfigSafe function', () => {
    it('should return success result with data', () => {
      const config = {
        gemini: {
          apiKey: 'test-key',
        },
      }

      const result = validateConfigSafe(config)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.errors).toBeUndefined()
    })

    it('should return failure result with formatted errors', () => {
      const config = {
        gemini: {
          apiKey: '',
        },
        attachmentRoots: [],
      }

      const result = validateConfigSafe(config)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.errors).toBeDefined()

      if (result.errors) {
        expect(result.errors.length).toBeGreaterThan(0)

        // Check error structure
        result.errors.forEach((err) => {
          expect(err).toHaveProperty('path')
          expect(err).toHaveProperty('message')
          expect(typeof err.path).toBe('string')
          expect(typeof err.message).toBe('string')
        })

        // Check that field paths are formatted correctly
        const paths = result.errors.map((e) => e.path)
        expect(paths).toContain('gemini.apiKey')
        expect(paths).toContain('attachmentRoots')
      }
    })
  })

  // CONFIG-T01-AC04: Config file discovery
  describe('CONFIG_FILE_PATTERNS', () => {
    it('should define expected config file patterns', () => {
      expect(CONFIG_FILE_PATTERNS).toEqual([
        './imessage-config.yaml',
        './imessage-config.yml',
        './imessage-config.json',
      ])
    })

    it('should check YAML files before JSON', () => {
      expect(CONFIG_FILE_PATTERNS[0]).toContain('.yaml')
      expect(CONFIG_FILE_PATTERNS[1]).toContain('.yml')
      expect(CONFIG_FILE_PATTERNS[2]).toContain('.json')
    })
  })

  // CONFIG-T01-AC02: Format detection
  describe('detectConfigFormat', () => {
    it('should detect JSON format', () => {
      expect(detectConfigFormat('./config.json')).toBe('json')
      expect(detectConfigFormat('imessage-config.json')).toBe('json')
    })

    it('should detect YAML format', () => {
      expect(detectConfigFormat('./config.yaml')).toBe('yaml')
      expect(detectConfigFormat('./config.yml')).toBe('yaml')
      expect(detectConfigFormat('imessage-config.yaml')).toBe('yaml')
    })

    it('should throw error for unsupported formats', () => {
      expect(() => detectConfigFormat('./config.toml')).toThrow(
        'Unsupported config file format'
      )
      expect(() => detectConfigFormat('./config.txt')).toThrow()
    })
  })

  describe('DEFAULT_CONFIG', () => {
    it('should provide sensible defaults', () => {
      expect(DEFAULT_CONFIG.version).toBe('1.0')
      expect(DEFAULT_CONFIG.attachmentRoots).toEqual([
        '~/Library/Messages/Attachments',
      ])
      expect(DEFAULT_CONFIG.enrichment?.checkpointInterval).toBe(100)
      expect(DEFAULT_CONFIG.render?.maxNestingDepth).toBe(10)
    })

    it('should have all feature flags enabled by default', () => {
      expect(DEFAULT_CONFIG.enrichment?.enableVisionAnalysis).toBe(true)
      expect(DEFAULT_CONFIG.enrichment?.enableAudioTranscription).toBe(true)
      expect(DEFAULT_CONFIG.enrichment?.enableLinkEnrichment).toBe(true)
    })
  })
})
