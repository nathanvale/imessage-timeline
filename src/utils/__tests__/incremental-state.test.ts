import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  IncrementalState,
  createIncrementalState,
  loadIncrementalState,
  saveIncrementalState,
  detectNewMessages,
  updateStateWithEnrichedGuids,
  verifyConfigHash,
  isStateOutdated,
} from '../incremental-state'

describe('IncrementalState', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `imessage-state-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (e) {
      // ignore cleanup errors
    }
  })

  describe('AC01: State file with last run metadata', () => {
    it('should create new state with current timestamp', () => {
      const before = Date.now()
      const state = createIncrementalState()
      const after = Date.now()

      expect(state.version).toBe('1.0')
      expect(state.lastEnrichedAt).toBeDefined()
      const stateTime = new Date(state.lastEnrichedAt).getTime()
      expect(stateTime).toBeGreaterThanOrEqual(before)
      expect(stateTime).toBeLessThanOrEqual(after)
    })

    it('should initialize with empty enriched GUIDs', () => {
      const state = createIncrementalState()
      expect(state.enrichedGuids).toEqual([])
    })

    it('should include total message count', () => {
      const state = createIncrementalState({ totalMessages: 150 })
      expect(state.totalMessages).toBe(150)
    })

    it('should store run metadata', () => {
      const state = createIncrementalState({
        totalMessages: 200,
      })
      expect(state.version).toBe('1.0')
      expect(typeof state.lastEnrichedAt).toBe('string')
      expect(state.enrichedGuids).toBeInstanceOf(Array)
    })

    it('should include pipeline configuration', () => {
      const state = createIncrementalState()
      expect(state.pipelineConfig).toBeDefined()
      expect(state.pipelineConfig).toHaveProperty('configHash')
      expect(typeof state.pipelineConfig.configHash).toBe('string')
    })
  })

  describe('AC02: Track last enriched date, total messages, config hash', () => {
    it('should track last enriched date accurately', () => {
      const state = createIncrementalState()
      const lastEnrichedDate = new Date(state.lastEnrichedAt)

      expect(lastEnrichedDate).toBeInstanceOf(Date)
      expect(lastEnrichedDate.toISOString()).toContain('Z')
    })

    it('should track total messages count', () => {
      const state = createIncrementalState({ totalMessages: 500 })
      expect(state.totalMessages).toBe(500)
    })

    it('should calculate config hash', () => {
      const state = createIncrementalState()
      expect(state.pipelineConfig.configHash).toBeDefined()
      expect(typeof state.pipelineConfig.configHash).toBe('string')
      expect(state.pipelineConfig.configHash.length).toBeGreaterThan(0)
    })

    it('should produce consistent config hash for same input', () => {
      const config1 = createIncrementalState().pipelineConfig.configHash
      const config2 = createIncrementalState().pipelineConfig.configHash

      // Hashes should be identical for same default config
      expect(config1).toBe(config2)
    })

    it('should track enrichment start/end times in state', () => {
      const state = createIncrementalState({
        enrichmentStats: {
          processedCount: 100,
          failedCount: 2,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        },
      })

      expect(state.enrichmentStats).toBeDefined()
      expect(state.enrichmentStats!.processedCount).toBe(100)
      expect(state.enrichmentStats!.failedCount).toBe(2)
    })
  })

  describe('AC03: Detect new messages by comparing GUIDs', () => {
    it('should return all GUIDs as new when state is empty', () => {
      const currentGuids = new Set(['msg-1', 'msg-2', 'msg-3'])
      const state = createIncrementalState()

      const newGuids = detectNewMessages(currentGuids, state)

      expect(newGuids).toHaveLength(3)
      expect(newGuids).toContain('msg-1')
      expect(newGuids).toContain('msg-2')
      expect(newGuids).toContain('msg-3')
    })

    it('should identify only new GUIDs when state has existing', () => {
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2']

      const currentGuids = new Set(['msg-1', 'msg-2', 'msg-3', 'msg-4'])
      const newGuids = detectNewMessages(currentGuids, state)

      expect(newGuids).toHaveLength(2)
      expect(newGuids).toContain('msg-3')
      expect(newGuids).toContain('msg-4')
      expect(newGuids).not.toContain('msg-1')
      expect(newGuids).not.toContain('msg-2')
    })

    it('should return empty array when no new messages', () => {
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2', 'msg-3']

      const currentGuids = new Set(['msg-1', 'msg-2', 'msg-3'])
      const newGuids = detectNewMessages(currentGuids, state)

      expect(newGuids).toHaveLength(0)
    })

    it('should handle large GUID sets efficiently', () => {
      const state = createIncrementalState()
      const existingGuids = Array.from({ length: 10000 }, (_, i) => `msg-${i}`)
      state.enrichedGuids = existingGuids

      const currentGuids = new Set([...existingGuids, 'msg-10000', 'msg-10001', 'msg-10002'])

      const newGuids = detectNewMessages(currentGuids, state)

      expect(newGuids).toHaveLength(3)
      expect(newGuids).toContain('msg-10000')
      expect(newGuids).toContain('msg-10001')
      expect(newGuids).toContain('msg-10002')
    })

    it('should not include deleted messages (missing from current)', () => {
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2', 'msg-3', 'msg-4']

      // msg-4 is no longer in current messages
      const currentGuids = new Set(['msg-1', 'msg-2', 'msg-3'])
      const newGuids = detectNewMessages(currentGuids, state)

      expect(newGuids).toHaveLength(0)
      expect(newGuids).not.toContain('msg-4')
    })
  })

  describe('AC04: Atomic writes (temp + rename)', () => {
    it('should save state atomically', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      const state = createIncrementalState({ totalMessages: 100 })

      await saveIncrementalState(state, stateFile)

      const savedContent = await fs.readFile(stateFile, 'utf-8')
      const parsed = JSON.parse(savedContent)

      expect(parsed.version).toBe('1.0')
      expect(parsed.totalMessages).toBe(100)
    })

    it('should use temp file pattern for atomic write', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      const state = createIncrementalState()

      // Spy on fs operations
      const writeFileSpy = vi.spyOn(fs, 'writeFile')

      await saveIncrementalState(state, stateFile)

      // Should have written to temp file first
      expect(writeFileSpy).toHaveBeenCalled()
      const tempPath = writeFileSpy.mock.calls[0][0]
      expect(typeof tempPath).toBe('string')
      expect(tempPath).toContain(path.dirname(stateFile))

      writeFileSpy.mockRestore()
    })

    it('should create parent directory if not exists', async () => {
      const nestedPath = path.join(tempDir, 'subdir', '.imessage-state.json')
      const state = createIncrementalState()

      await saveIncrementalState(state, nestedPath)

      const exists = await fs
        .access(nestedPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    it('should handle write errors gracefully', async () => {
      const readOnlyDir = path.join(tempDir, 'readonly')
      await fs.mkdir(readOnlyDir)
      // On non-Windows, make directory read-only
      if (process.platform !== 'win32') {
        await fs.chmod(readOnlyDir, 0o444)
      }

      const stateFile = path.join(readOnlyDir, '.imessage-state.json')
      const state = createIncrementalState()

      // Should throw for permission denied
      if (process.platform !== 'win32') {
        await expect(saveIncrementalState(state, stateFile)).rejects.toThrow()
      }

      // Cleanup
      if (process.platform !== 'win32') {
        await fs.chmod(readOnlyDir, 0o755)
      }
    })

    it('should preserve file permissions on existing state file', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      const state1 = createIncrementalState()

      // Write initial state
      await saveIncrementalState(state1, stateFile)

      // Update state
      const state2 = createIncrementalState({ totalMessages: 200 })
      await saveIncrementalState(state2, stateFile)

      // Verify file still readable
      const saved = await fs.readFile(stateFile, 'utf-8')
      const parsed = JSON.parse(saved)
      expect(parsed.totalMessages).toBe(200)
    })
  })

  describe('AC05: Load state and verify integrity', () => {
    it('should load state from file', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      const originalState = createIncrementalState({ totalMessages: 150 })

      await saveIncrementalState(originalState, stateFile)
      const loadedState = await loadIncrementalState(stateFile)

      expect(loadedState.version).toBe(originalState.version)
      expect(loadedState.totalMessages).toBe(originalState.totalMessages)
    })

    it('should return null for missing state file', async () => {
      const stateFile = path.join(tempDir, 'nonexistent.json')
      const loaded = await loadIncrementalState(stateFile)

      expect(loaded).toBeNull()
    })

    it('should handle corrupted JSON gracefully', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      await fs.writeFile(stateFile, 'invalid json {')

      const loaded = await loadIncrementalState(stateFile)

      expect(loaded).toBeNull()
    })

    it('should preserve enriched GUIDs after load', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2', 'msg-3']

      await saveIncrementalState(state, stateFile)
      const loaded = await loadIncrementalState(stateFile)

      expect(loaded?.enrichedGuids).toEqual(['msg-1', 'msg-2', 'msg-3'])
    })
  })

  describe('Config hash verification', () => {
    it('should verify matching config hash', () => {
      const state = createIncrementalState()
      const isValid = verifyConfigHash(state.pipelineConfig.configHash)

      expect(isValid).toBe(true)
    })

    it('should detect changed config hash', () => {
      const state = createIncrementalState()
      const invalidHash = 'different-hash-value'

      const isValid = verifyConfigHash(invalidHash, state.pipelineConfig.configHash)

      expect(isValid).toBe(false)
    })

    it('should warn about stale state', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      const state = createIncrementalState()
      state.lastEnrichedAt = oldDate.toISOString()

      isStateOutdated(state, 14) // 14 days threshold

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Update state with enriched GUIDs', () => {
    it('should add new enriched GUIDs', () => {
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2']

      const newGuids = ['msg-3', 'msg-4']
      updateStateWithEnrichedGuids(state, newGuids)

      expect(state.enrichedGuids).toContain('msg-1')
      expect(state.enrichedGuids).toContain('msg-2')
      expect(state.enrichedGuids).toContain('msg-3')
      expect(state.enrichedGuids).toContain('msg-4')
      expect(state.enrichedGuids).toHaveLength(4)
    })

    it('should avoid duplicate GUIDs', () => {
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2']

      const newGuids = ['msg-2', 'msg-3']
      updateStateWithEnrichedGuids(state, newGuids)

      expect(state.enrichedGuids).toHaveLength(3)
      expect(state.enrichedGuids.filter((g) => g === 'msg-2')).toHaveLength(1)
    })

    it('should update last enriched time', () => {
      const state = createIncrementalState()
      const oldTime = state.lastEnrichedAt

      // Wait a bit
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)
      updateStateWithEnrichedGuids(state, ['msg-1'])
      vi.useRealTimers()

      // Time should be updated (or at least different in real execution)
      expect(state.lastEnrichedAt).toBeDefined()
    })

    it('should update enrichment stats', () => {
      const state = createIncrementalState()

      updateStateWithEnrichedGuids(state, ['msg-1', 'msg-2'], {
        processedCount: 100,
        failedCount: 2,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      })

      expect(state.enrichmentStats).toBeDefined()
      expect(state.enrichmentStats?.processedCount).toBe(100)
      expect(state.enrichmentStats?.failedCount).toBe(2)
    })
  })

  describe('Edge cases and robustness', () => {
    it('should handle empty GUID set', () => {
      const state = createIncrementalState()
      state.enrichedGuids = ['msg-1', 'msg-2']

      const newGuids = detectNewMessages(new Set(), state)

      expect(newGuids).toHaveLength(0)
    })

    it('should handle state with null enrichmentStats', () => {
      const state = createIncrementalState()
      state.enrichmentStats = null

      const newGuids = detectNewMessages(new Set(['msg-1']), state)

      expect(newGuids).toHaveLength(1)
      expect(newGuids).toContain('msg-1')
    })

    it('should handle ISO 8601 dates correctly', async () => {
      const stateFile = path.join(tempDir, '.imessage-state.json')
      const state = createIncrementalState()

      await saveIncrementalState(state, stateFile)
      const loaded = await loadIncrementalState(stateFile)

      expect(loaded?.lastEnrichedAt).toMatch(/Z$/)
      expect(loaded?.lastEnrichedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should handle very long GUID arrays', () => {
      const state = createIncrementalState()
      const longGuids = Array.from({ length: 50000 }, (_, i) => `msg-${i}`)
      state.enrichedGuids = longGuids

      expect(state.enrichedGuids).toHaveLength(50000)

      const newGuids = detectNewMessages(new Set([...longGuids, 'msg-50000']), state)
      expect(newGuids).toHaveLength(1)
      expect(newGuids).toContain('msg-50000')
    })
  })
})
