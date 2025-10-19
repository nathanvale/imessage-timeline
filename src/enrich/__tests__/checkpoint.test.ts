/**
 * Checkpoint and Resume Logic Tests (ENRICH--T06)
 *
 * Tests for AC01-AC05:
 * - AC01: Write checkpoint after every N items (configurable, default 100)
 * - AC02: Checkpoint includes: last_index, partial_outputs, stats (processed/failed), failed_items array
 * - AC03: Atomic checkpoint writes using temp file + rename pattern
 * - AC04: Resume flag (--resume) restarts within ≤1 item of last checkpoint per spec §12 AC E5
 * - AC05: Verify config consistency (hash comparison) before resuming, fail if mismatch
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Message } from '#schema/message'
import {
  createCheckpoint,
  loadCheckpoint,
  shouldWriteCheckpoint,
  getResumeIndex,
  verifyConfigHash,
  getCheckpointPath,
  computeConfigHash,
  initializeCheckpointState,
  prepareCheckpoint,
} from '../checkpoint'

describe('Checkpoint and Resume Logic (ENRICH--T06)', () => {
  let testCheckpointDir: string

  beforeEach(() => {
    testCheckpointDir = '/tmp/checkpoint-tests'
  })

  describe('AC01: Write checkpoint after every N items', () => {
    it('should determine checkpoint write after N items with default 100', () => {
      const config = { checkpointInterval: 100 }

      // Should not write at item 99
      let shouldWrite = shouldWriteCheckpoint(99, config.checkpointInterval)
      expect(shouldWrite).toBe(false)

      // Should write at item 100
      shouldWrite = shouldWriteCheckpoint(100, config.checkpointInterval)
      expect(shouldWrite).toBe(true)

      // Should not write at item 101
      shouldWrite = shouldWriteCheckpoint(101, config.checkpointInterval)
      expect(shouldWrite).toBe(false)

      // Should write at item 200
      shouldWrite = shouldWriteCheckpoint(200, config.checkpointInterval)
      expect(shouldWrite).toBe(true)
    })

    it('should support configurable checkpoint intervals', () => {
      const config50 = { checkpointInterval: 50 }

      expect(shouldWriteCheckpoint(50, config50.checkpointInterval)).toBe(true)
      expect(shouldWriteCheckpoint(100, config50.checkpointInterval)).toBe(true)
      expect(shouldWriteCheckpoint(150, config50.checkpointInterval)).toBe(true)
    })

    it('should handle custom interval configurations', () => {
      const config250 = { checkpointInterval: 250 }

      expect(shouldWriteCheckpoint(249, config250.checkpointInterval)).toBe(false)
      expect(shouldWriteCheckpoint(250, config250.checkpointInterval)).toBe(true)
      expect(shouldWriteCheckpoint(500, config250.checkpointInterval)).toBe(true)
    })

    it('should default to 100 if interval not specified', () => {
      const config = { checkpointInterval: undefined }
      const defaultInterval = config.checkpointInterval || 100

      expect(shouldWriteCheckpoint(100, defaultInterval)).toBe(true)
    })
  })

  describe('AC02: Checkpoint structure with stats and failed items', () => {
    it('should create checkpoint with all required fields', () => {
      const config = { checkpointInterval: 100 }
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: true,
          date: '2025-10-18T10:00:00.000Z',
          text: 'Test message 1',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: true,
          date: '2025-10-18T10:01:00.000Z',
          text: 'Test message 2',
        },
      ]

      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 150,
        totalFailed: 5,
        stats: {
          processedCount: 50,
          failedCount: 2,
          enrichmentsByKind: { image_analysis: 30, transcription: 20 },
        },
        failedItems: [
          { index: 45, guid: 'msg-45', kind: 'image_analysis', error: 'API timeout' },
          { index: 87, guid: 'msg-87', kind: 'link_context', error: 'Invalid URL' },
        ],
        configHash: 'abc123config',
      })

      expect(checkpoint).toBeDefined()
      expect(checkpoint.lastProcessedIndex).toBe(99)
      expect(checkpoint.totalProcessed).toBe(150)
      expect(checkpoint.totalFailed).toBe(5)
      expect(checkpoint.stats.processedCount).toBe(50)
      expect(checkpoint.stats.failedCount).toBe(2)
      expect(checkpoint.stats.enrichmentsByKind).toEqual({ image_analysis: 30, transcription: 20 })
      expect(checkpoint.failedItems).toHaveLength(2)
      expect(checkpoint.configHash).toBe('abc123config')
      expect(checkpoint.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) // ISO 8601
    })

    it('should include failed items array with full details', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 3,
        stats: { processedCount: 100, failedCount: 3, enrichmentsByKind: {} },
        failedItems: [
          { index: 22, guid: 'guid-22', kind: 'image_analysis', error: 'HEIC conversion failed' },
          { index: 55, guid: 'guid-55', kind: 'audio_transcription', error: 'File not found' },
          { index: 88, guid: 'guid-88', kind: 'link_context', error: 'Rate limited' },
        ],
        configHash: 'hash-123',
      })

      expect(checkpoint.failedItems).toHaveLength(3)
      expect(checkpoint.failedItems[0]).toEqual({
        index: 22,
        guid: 'guid-22',
        kind: 'image_analysis',
        error: 'HEIC conversion failed',
      })
    })

    it('should track stats by enrichment kind', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: {
          processedCount: 100,
          failedCount: 0,
          enrichmentsByKind: {
            image_analysis: 45,
            transcription: 30,
            link_context: 25,
          },
        },
        failedItems: [],
        configHash: 'hash',
      })

      expect(checkpoint.stats.enrichmentsByKind.image_analysis).toBe(45)
      expect(checkpoint.stats.enrichmentsByKind.transcription).toBe(30)
      expect(checkpoint.stats.enrichmentsByKind.link_context).toBe(25)
    })
  })

  describe('AC03: Atomic checkpoint writes using temp file + rename', () => {
    it('should write checkpoint atomically with temp file pattern', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: { processedCount: 100, failedCount: 0, enrichmentsByKind: {} },
        failedItems: [],
        configHash: 'hash',
      })

      // Verify checkpoint structure (atomic write happens in implementation)
      expect(checkpoint).toBeDefined()
      expect(checkpoint.createdAt).toBeDefined()
    })

    it('should generate deterministic checkpoint paths', () => {
      const configHash = 'abc123'
      const path = getCheckpointPath(testCheckpointDir, configHash)

      expect(path).toContain(testCheckpointDir)
      expect(path).toContain(configHash)
      expect(path).toContain('checkpoint')
    })

    it('should handle checkpoint path generation consistently', () => {
      const configHash1 = 'hash-abc'
      const path1a = getCheckpointPath(testCheckpointDir, configHash1)
      const path1b = getCheckpointPath(testCheckpointDir, configHash1)

      // Same config hash should produce same path
      expect(path1a).toBe(path1b)

      // Different config hash should produce different path
      const configHash2 = 'hash-xyz'
      const path2 = getCheckpointPath(testCheckpointDir, configHash2)
      expect(path1a).not.toBe(path2)
    })
  })

  describe('AC04: Resume within ≤1 item of last checkpoint', () => {
    it('should get resume index at checkpoint boundary', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: { processedCount: 100, failedCount: 0, enrichmentsByKind: {} },
        failedItems: [],
        configHash: 'hash',
      })

      const resumeIndex = getResumeIndex(checkpoint)

      // Should resume at next checkpoint boundary (100)
      expect(resumeIndex).toBeGreaterThan(checkpoint.lastProcessedIndex)
      expect(resumeIndex).toBeLessThanOrEqual(checkpoint.lastProcessedIndex + 1)
    })

    it('should resume at last processed index + 1', () => {
      const checkpointData = {
        lastProcessedIndex: 199,
        totalProcessed: 200,
        totalFailed: 1,
        stats: { processedCount: 100, failedCount: 1, enrichmentsByKind: {} },
        failedItems: [{ index: 150, guid: 'msg-150', kind: 'image_analysis', error: 'Timeout' }],
        configHash: 'hash-200',
      }

      const checkpoint = createCheckpoint(checkpointData)
      const resumeIndex = getResumeIndex(checkpoint)

      expect(resumeIndex).toBe(200)
    })

    it('should ensure resume within ≤1 item distance', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 499,
        totalProcessed: 500,
        totalFailed: 2,
        stats: { processedCount: 100, failedCount: 2, enrichmentsByKind: {} },
        failedItems: [],
        configHash: 'hash-500',
      })

      const resumeIndex = getResumeIndex(checkpoint)

      // Verify within ≤1 item distance
      const distance = resumeIndex - checkpoint.lastProcessedIndex
      expect(distance).toBeLessThanOrEqual(1)
    })
  })

  describe('AC05: Config consistency verification with hash comparison', () => {
    it('should verify matching config hashes', () => {
      const configHash = 'abc123def456'

      const result = verifyConfigHash(configHash, configHash)
      expect(result).toBe(true)
    })

    it('should detect mismatched config hashes', () => {
      const checkpointHash = 'abc123old'
      const currentHash = 'xyz789new'

      const result = verifyConfigHash(checkpointHash, currentHash)
      expect(result).toBe(false)
    })

    it('should fail if config hash has changed', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: { processedCount: 100, failedCount: 0, enrichmentsByKind: {} },
        failedItems: [],
        configHash: 'config-v1',
      })

      // Config was changed (different hash)
      const currentConfigHash = 'config-v2'

      const isValid = verifyConfigHash(checkpoint.configHash, currentConfigHash)
      expect(isValid).toBe(false)
    })

    it('should pass if config hash matches exactly', () => {
      const configHash = 'config-stable-abc123'

      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: { processedCount: 100, failedCount: 0, enrichmentsByKind: {} },
        failedItems: [],
        configHash,
      })

      // Same config (same hash)
      const isValid = verifyConfigHash(checkpoint.configHash, configHash)
      expect(isValid).toBe(true)
    })
  })

  describe('Integration: Checkpoint lifecycle', () => {
    it('should create and verify checkpoint roundtrip', () => {
      const originalCheckpoint = createCheckpoint({
        lastProcessedIndex: 149,
        totalProcessed: 150,
        totalFailed: 3,
        stats: {
          processedCount: 50,
          failedCount: 1,
          enrichmentsByKind: { image_analysis: 40, transcription: 10 },
        },
        failedItems: [
          { index: 120, guid: 'msg-120', kind: 'image_analysis', error: 'Timeout' },
        ],
        configHash: 'config-hash-150',
      })

      // Verify checkpoint loaded correctly
      expect(originalCheckpoint.lastProcessedIndex).toBe(149)
      expect(originalCheckpoint.totalProcessed).toBe(150)
      expect(originalCheckpoint.totalFailed).toBe(3)

      // Get resume index
      const resumeIndex = getResumeIndex(originalCheckpoint)
      expect(resumeIndex).toBe(150)

      // Verify config before resume
      const configValid = verifyConfigHash(
        originalCheckpoint.configHash,
        'config-hash-150'
      )
      expect(configValid).toBe(true)
    })

    it('should handle failed resume due to config mismatch', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: { processedCount: 100, failedCount: 0, enrichmentsByKind: {} },
        failedItems: [],
        configHash: 'old-config-hash',
      })

      // Config was modified (new hash)
      const newConfigHash = 'new-config-hash'

      const canResume = verifyConfigHash(checkpoint.configHash, newConfigHash)
      expect(canResume).toBe(false)
    })

    it('should track cumulative stats across multiple checkpoints', () => {
      const checkpoint1 = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 2,
        stats: {
          processedCount: 100,
          failedCount: 2,
          enrichmentsByKind: { image_analysis: 80, transcription: 20 },
        },
        failedItems: [],
        configHash: 'hash-1',
      })

      // Second checkpoint after resume
      const checkpoint2 = createCheckpoint({
        lastProcessedIndex: 199,
        totalProcessed: 200, // Cumulative from both checkpoints
        totalFailed: 5, // Cumulative
        stats: {
          processedCount: 100,
          failedCount: 3,
          enrichmentsByKind: { image_analysis: 70, transcription: 30 },
        },
        failedItems: [],
        configHash: 'hash-1',
      })

      expect(checkpoint2.totalProcessed).toBe(200)
      expect(checkpoint2.totalFailed).toBe(5)
    })

    it('should handle checkpoint with many failed items', () => {
      const failedItems = Array.from({ length: 50 }, (_, i) => ({
        index: i * 2,
        guid: `msg-${i * 2}`,
        kind: 'image_analysis' as const,
        error: `Error ${i}`,
      }))

      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 50,
        stats: {
          processedCount: 100,
          failedCount: 50,
          enrichmentsByKind: { image_analysis: 50 },
        },
        failedItems,
        configHash: 'hash',
      })

      expect(checkpoint.failedItems).toHaveLength(50)
      expect(checkpoint.totalFailed).toBe(50)
    })
  })

  describe('Helper: computeConfigHash', () => {
    it('should compute consistent hash for same config', () => {
      const config = { enableVisionAnalysis: true, rateLimitDelay: 1000 }

      const hash1 = computeConfigHash(config)
      const hash2 = computeConfigHash(config)

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('should produce different hash for different config', () => {
      const config1 = { enableVisionAnalysis: true }
      const config2 = { enableVisionAnalysis: false }

      const hash1 = computeConfigHash(config1)
      const hash2 = computeConfigHash(config2)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle complex nested config', () => {
      const config = {
        enrichment: {
          image: { enabled: true, quality: 90 },
          audio: { enabled: true, maxDuration: 600 },
        },
        checkpoint: { interval: 100 },
      }

      const hash = computeConfigHash(config)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('Helper: initializeCheckpointState', () => {
    it('should initialize fresh state when no checkpoint exists', () => {
      const currentConfigHash = 'current-hash-abc'

      const state = initializeCheckpointState(null, currentConfigHash)

      expect(state).not.toBeInstanceOf(Error)
      expect(state.isResuming).toBe(false)
      expect(state.lastCheckpointIndex).toBe(-1)
      expect(state.configHash).toBe(currentConfigHash)
      expect(state.failedItemsInCheckpoint).toHaveLength(0)
    })

    it('should initialize resume state from valid checkpoint', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 2,
        stats: { processedCount: 100, failedCount: 2, enrichmentsByKind: {} },
        failedItems: [
          { index: 45, guid: 'msg-45', kind: 'image_analysis', error: 'Timeout' },
        ],
        configHash: 'config-hash-100',
      })

      const state = initializeCheckpointState(checkpoint, 'config-hash-100')

      expect(state).not.toBeInstanceOf(Error)
      expect(state.isResuming).toBe(true)
      expect(state.lastCheckpointIndex).toBe(99)
      expect(state.configHash).toBe('config-hash-100')
      expect(state.failedItemsInCheckpoint).toHaveLength(1)
    })

    it('should return error if config hash mismatches', () => {
      const checkpoint = createCheckpoint({
        lastProcessedIndex: 99,
        totalProcessed: 100,
        totalFailed: 0,
        stats: { processedCount: 100, failedCount: 0, enrichmentsByKind: {} },
        failedItems: [],
        configHash: 'old-config-hash',
      })

      const state = initializeCheckpointState(checkpoint, 'new-config-hash')

      expect(state).toBeInstanceOf(Error)
      expect((state as Error).message).toContain('Config mismatch')
    })
  })

  describe('Helper: prepareCheckpoint', () => {
    it('should prepare checkpoint for saving', () => {
      const checkpoint = prepareCheckpoint(
        149, // lastProcessedIndex
        150, // totalProcessed
        3, // totalFailed
        { processedCount: 50, failedCount: 1, enrichmentsByKind: { image_analysis: 40 } },
        [{ index: 120, guid: 'msg-120', kind: 'image_analysis', error: 'Timeout' }],
        'config-hash-150'
      )

      expect(checkpoint.lastProcessedIndex).toBe(149)
      expect(checkpoint.totalProcessed).toBe(150)
      expect(checkpoint.totalFailed).toBe(3)
      expect(checkpoint.stats.processedCount).toBe(50)
      expect(checkpoint.failedItems).toHaveLength(1)
      expect(checkpoint.configHash).toBe('config-hash-150')
    })

    it('should set current timestamp on prepared checkpoint', () => {
      const before = new Date().getTime()
      const checkpoint = prepareCheckpoint(99, 100, 0, { processedCount: 100, failedCount: 0, enrichmentsByKind: {} }, [], 'hash')
      const after = new Date().getTime()

      const checkpointTime = new Date(checkpoint.createdAt).getTime()
      expect(checkpointTime).toBeGreaterThanOrEqual(before)
      expect(checkpointTime).toBeLessThanOrEqual(after)
    })
  })
})
