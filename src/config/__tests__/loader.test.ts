/**
 * Tests for CONFIG--T02: Implement Config Loader
 *
 * Validates:
 * - AC01: Load config from file with YAML/JSON auto-detection
 * - AC02: Merge with CLI options (CLI > config > defaults)
 * - AC03: Environment variable substitution with ${VAR} syntax
 * - AC04: Config validation with helpful error messages
 * - AC05: Cache loaded config to avoid repeated file reads
 */

import { writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  loadConfig,
  loadConfigFile,
  discoverConfigFile,
  substituteEnvVars,
  mergeConfig,
  clearConfigCache,
  isConfigCached,
} from '../loader'

import type { Config } from '../schema'

describe('Config Loader', () => {
  let testDir: string
  const originalEnv = process.env
  const originalCwd = process.cwd()

  beforeEach(async () => {
    // Create temp directory for test files
    testDir = join(tmpdir(), `imessage-config-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    // Clear cache before each test
    clearConfigCache()

    // Reset environment
    process.env = { ...originalEnv }
  })

  afterEach(async () => {
    // Cleanup test files
    try {
      const files = [
        'imessage-config.yaml',
        'imessage-config.yml',
        'imessage-config.json',
        'custom-config.yaml',
        'custom-config.json',
      ]
      await Promise.all(
        files.map((f) =>
          unlink(join(testDir, f)).catch(() => {
            /* ignore */
          }),
        ),
      )
    } catch {
      /* ignore cleanup errors */
    }

    // Restore environment
    process.env = originalEnv
  })

  // CONFIG-T02-AC03: Environment variable substitution
  describe('substituteEnvVars', () => {
    it('should replace ${VAR} in strings', () => {
      process.env.TEST_VAR = 'test-value'

      const result = substituteEnvVars({ key: '${TEST_VAR}' })

      expect(result).toEqual({ key: 'test-value' })
    })

    it('should replace multiple ${VAR} patterns in same string', () => {
      process.env.VAR1 = 'hello'
      process.env.VAR2 = 'world'

      const result = substituteEnvVars('${VAR1} ${VAR2}')

      expect(result).toBe('hello world')
    })

    it('should recursively substitute in nested objects', () => {
      process.env.API_KEY = 'secret123'
      process.env.MODEL = 'gemini-pro'

      const result = substituteEnvVars({
        gemini: {
          apiKey: '${API_KEY}',
          model: '${MODEL}',
        },
      })

      expect(result).toEqual({
        gemini: {
          apiKey: 'secret123',
          model: 'gemini-pro',
        },
      })
    })

    it('should substitute in arrays', () => {
      process.env.ROOT1 = '/path/one'
      process.env.ROOT2 = '/path/two'

      const result = substituteEnvVars(['${ROOT1}', '${ROOT2}'])

      expect(result).toEqual(['/path/one', '/path/two'])
    })

    it('should throw error for undefined environment variables', () => {
      delete process.env.MISSING_VAR

      expect(() => {
        substituteEnvVars({ key: '${MISSING_VAR}' })
      }).toThrow('Environment variable MISSING_VAR is not set')
    })

    it('should leave non-env-var strings unchanged', () => {
      const result = substituteEnvVars('plain string')

      expect(result).toBe('plain string')
    })

    it('should pass through primitives unchanged', () => {
      expect(substituteEnvVars(123)).toBe(123)
      expect(substituteEnvVars(true)).toBe(true)
      expect(substituteEnvVars(null)).toBe(null)
    })
  })

  // CONFIG-T02-AC02: Config merging with precedence
  describe('mergeConfig', () => {
    it('should merge CLI options over file config', () => {
      const fileConfig: Partial<Config> = {
        gemini: {
          apiKey: 'file-key',
          model: 'file-model',
          rateLimitDelay: 1000,
          maxRetries: 3,
        },
      }

      const cliOptions: Partial<Config> = {
        gemini: {
          apiKey: 'cli-key',
          model: 'gemini-1.5-pro',
          rateLimitDelay: 1000,
          maxRetries: 3,
        },
      }

      const result = mergeConfig(fileConfig, cliOptions)

      expect(result.gemini?.apiKey).toBe('cli-key')
    })

    it('should preserve file config when CLI options not provided', () => {
      const fileConfig: Partial<Config> = {
        enrichment: {
          enableVisionAnalysis: true,
          enableAudioTranscription: true,
          enableLinkEnrichment: true,
          imageCacheDir: './.cache/images',
          checkpointInterval: 100,
          forceRefresh: false,
        },
      }

      const result = mergeConfig(fileConfig, {})

      expect(result.enrichment?.enableVisionAnalysis).toBe(true)
    })

    it('should deep merge nested objects', () => {
      const fileConfig: Partial<Config> = {
        gemini: {
          apiKey: 'file-key',
          model: 'file-model',
          rateLimitDelay: 1000,
          maxRetries: 3,
        },
      }

      const cliOptions: Partial<Config> = {
        gemini: {
          apiKey: 'cli-key',
          model: 'gemini-1.5-pro',
          rateLimitDelay: 1000,
          maxRetries: 3,
        },
      }

      const result = mergeConfig(fileConfig, cliOptions)

      expect(result.gemini?.apiKey).toBe('cli-key')
      expect(result.gemini?.model).toBe('gemini-1.5-pro')
    })
  })

  // CONFIG-T02-AC01: File loading with auto-detection
  describe('loadConfigFile', () => {
    it('should load and parse JSON config', async () => {
      const configPath = join(testDir, 'test-config.json')
      const config = {
        version: '1.0',
        gemini: {
          apiKey: 'test-key',
        },
      }

      await writeFile(configPath, JSON.stringify(config))

      const result = await loadConfigFile(configPath)

      expect(result).toEqual(config)
    })

    it('should load and parse YAML config', async () => {
      const configPath = join(testDir, 'test-config.yaml')
      const yamlContent = `
version: "1.0"
gemini:
  apiKey: test-key
`

      await writeFile(configPath, yamlContent)

      const result = await loadConfigFile(configPath)

      expect(result).toEqual({
        version: '1.0',
        gemini: {
          apiKey: 'test-key',
        },
      })
    })

    it('should throw error for invalid JSON', async () => {
      const configPath = join(testDir, 'invalid.json')
      await writeFile(configPath, '{ invalid json')

      await expect(loadConfigFile(configPath)).rejects.toThrow('Failed to parse JSON')
    })

    it('should throw error for invalid YAML', async () => {
      const configPath = join(testDir, 'invalid.yaml')
      await writeFile(configPath, 'invalid: [yaml: syntax')

      await expect(loadConfigFile(configPath)).rejects.toThrow('Failed to parse YAML')
    })

    it('should throw error for unsupported format', async () => {
      const configPath = join(testDir, 'config.toml')
      await writeFile(configPath, 'key = "value"')

      await expect(loadConfigFile(configPath)).rejects.toThrow('Unsupported config file format')
    })
  })

  // CONFIG-T02-AC01: Config file discovery
  describe('discoverConfigFile', () => {
    it('should find .yaml file first', async () => {
      await writeFile(join(testDir, 'imessage-config.yaml'), 'version: "1.0"')
      await writeFile(join(testDir, 'imessage-config.json'), '{"version": "1.0"}')

      const result = await discoverConfigFile(testDir)

      expect(result).toBe(`${testDir}/imessage-config.yaml`)
    })

    it('should find .yml file second', async () => {
      await writeFile(join(testDir, 'imessage-config.yml'), 'version: "1.0"')
      await writeFile(join(testDir, 'imessage-config.json'), '{"version": "1.0"}')

      const result = await discoverConfigFile(testDir)

      expect(result).toBe(`${testDir}/imessage-config.yml`)
    })

    it('should find .json file last', async () => {
      await writeFile(join(testDir, 'imessage-config.json'), '{"version": "1.0"}')

      const result = await discoverConfigFile(testDir)

      expect(result).toBe(`${testDir}/imessage-config.json`)
    })

    it('should return null when no config files exist', async () => {
      const result = await discoverConfigFile(testDir)

      expect(result).toBe(null)
    })
  })

  // CONFIG-T02: Integration tests
  describe('loadConfig', () => {
    it('should load config from YAML file with defaults applied', async () => {
      process.env.GEMINI_API_KEY = 'test-api-key'

      const yamlContent = `
version: "1.0"
gemini:
  apiKey: \${GEMINI_API_KEY}
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      const config = await loadConfig({ configPath })

      expect(config.version).toBe('1.0')
      expect(config.gemini.apiKey).toBe('test-api-key')
      expect(config.gemini.model).toBe('gemini-1.5-pro') // default
      expect(config.enrichment.checkpointInterval).toBe(100) // default
    })

    it('should load config from JSON file', async () => {
      process.env.GEMINI_API_KEY = 'json-key'

      const jsonConfig = {
        version: '1.0',
        gemini: {
          apiKey: '${GEMINI_API_KEY}',
        },
      }

      const configPath = join(testDir, 'imessage-config.json')
      await writeFile(configPath, JSON.stringify(jsonConfig))

      const config = await loadConfig({ configPath })

      expect(config.gemini.apiKey).toBe('json-key')
    })

    it('should merge CLI options over file config', async () => {
      process.env.GEMINI_API_KEY = 'file-key'

      const yamlContent = `
gemini:
  apiKey: \${GEMINI_API_KEY}
  model: file-model
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      const config = await loadConfig({
        configPath,
        cliOptions: {
          gemini: {
            apiKey: 'cli-override',
            model: 'gemini-1.5-pro',
            rateLimitDelay: 1000,
            maxRetries: 3,
          },
        },
      })

      expect(config.gemini.apiKey).toBe('cli-override')
    })

    it('should work without config file using only defaults', async () => {
      process.env.GEMINI_API_KEY = 'env-key'

      const config = await loadConfig({
        cliOptions: {
          gemini: {
            apiKey: process.env.GEMINI_API_KEY,
            model: 'gemini-1.5-pro',
            rateLimitDelay: 1000,
            maxRetries: 3,
          },
        },
      })

      expect(config.gemini.apiKey).toBe('env-key')
      expect(config.attachmentRoots).toEqual(['~/Library/Messages/Attachments'])
    })

    it('should use explicit configPath if provided', async () => {
      process.env.GEMINI_API_KEY = 'custom-key'

      const customPath = join(testDir, 'custom-config.yaml')
      await writeFile(
        customPath,
        `
gemini:
  apiKey: \${GEMINI_API_KEY}
`,
      )

      const config = await loadConfig({ configPath: customPath })

      expect(config.gemini.apiKey).toBe('custom-key')
    })

    it('should throw error if required env var is missing', async () => {
      delete process.env.GEMINI_API_KEY

      const yamlContent = `
gemini:
  apiKey: \${GEMINI_API_KEY}
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      await expect(loadConfig({ configPath })).rejects.toThrow(
        'Environment variable GEMINI_API_KEY is not set',
      )
    })

    // CONFIG-T02-AC04: Validation errors
    it('should throw validation error for invalid config', async () => {
      const yamlContent = `
gemini:
  apiKey: ""
  maxRetries: 99
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      await expect(loadConfig({ configPath })).rejects.toThrow('Config validation failed')
    })
  })

  // CONFIG-T02-AC05: Caching
  describe('config caching', () => {
    it('should cache loaded config', async () => {
      process.env.GEMINI_API_KEY = 'cached-key'

      const yamlContent = `
gemini:
  apiKey: \${GEMINI_API_KEY}
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      // First load
      const config1 = await loadConfig({ configPath })

      expect(isConfigCached()).toBe(true)

      // Second load should return cached version
      const config2 = await loadConfig({ configPath })

      expect(config1).toBe(config2) // Same object reference
    })

    it('should skip cache when skipCache is true', async () => {
      process.env.GEMINI_API_KEY = 'key1'

      const yamlContent = `
gemini:
  apiKey: \${GEMINI_API_KEY}
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      // First load
      const config1 = await loadConfig({ configPath })

      // Change env var
      process.env.GEMINI_API_KEY = 'key2'

      // Load with skipCache
      const config2 = await loadConfig({ configPath, skipCache: true })

      expect(config1.gemini.apiKey).toBe('key1')
      expect(config2.gemini.apiKey).toBe('key2')
      expect(config1).not.toBe(config2)
    })

    it('should clear cache when clearConfigCache is called', async () => {
      process.env.GEMINI_API_KEY = 'cached-key'

      const yamlContent = `
gemini:
  apiKey: \${GEMINI_API_KEY}
`

      const configPath = join(testDir, 'imessage-config.yaml')
      await writeFile(configPath, yamlContent)

      await loadConfig({ configPath })
      expect(isConfigCached()).toBe(true)

      clearConfigCache()
      expect(isConfigCached()).toBe(false)
    })
  })
})
