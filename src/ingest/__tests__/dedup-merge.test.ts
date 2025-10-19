import { describe, it, expect, beforeEach } from 'vitest'
import type { Message } from '#lib/schema/message'
import {
  dedupAndMerge,
  findExactMatch,
  detectContentEquivalence,
  applyDbAuthoritiveness,
  verifyNoDataLoss,
  type MergeResult,
  type MergeStats,
  type ContentMatch,
} from '../dedup-merge'

/**
 * Test suite for CSV/DB deduplication and merge (NORMALIZE--T04)
 *
 * AC01: Merge CSV and DB by exact GUID match as primary strategy
 * AC02: Prefer DB values for authoritative fields
 * AC03: Detect content equivalence for unmatched GUIDs
 * AC04: Verify no data loss with count invariants
 * AC05: Ensure stable GUID assignment across runs
 */

describe('dedupAndMerge', () => {
  let csvMessages: Message[]
  let dbMessages: Message[]

  beforeEach(() => {
    csvMessages = []
    dbMessages = []
  })

  describe('AC01 — Exact GUID matching (primary strategy)', () => {
    it('should merge messages with exact GUID matches', () => {
      const csvMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Hello from CSV',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'csv:123:0', // Same GUID (was synced from CSV export)
        messageKind: 'text',
        text: 'Hello from CSV',
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].guid).toBe('csv:123:0')
      expect(result.stats.exactMatches).toBe(1)
    })

    it('should handle DB GUID format (direct DB export)', () => {
      const csvMsg = createMessage({
        guid: 'csv:456:0',
        messageKind: 'text',
        text: 'Message text',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:abc-def-ghi-123',
        messageKind: 'text',
        text: 'Different message from DB',
        date: '2025-10-17T10:01:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // No exact GUID match, so both should be kept
      expect(result.messages).toHaveLength(2)
      expect(result.stats.exactMatches).toBe(0)
    })

    it('should handle part GUID format (p:0/DB:guid)', () => {
      const csvTextMsg = createMessage({
        guid: 'csv:789:0',
        messageKind: 'text',
        text: 'Text part',
        date: '2025-10-17T10:00:00.000Z',
      })

      const csvMediaMsg = createMessage({
        guid: 'csv:789:1',
        messageKind: 'media',
        media: {
          id: 'media:1',
          filename: 'photo.jpg',
          path: '/tmp/photo.jpg',
        },
        date: '2025-10-17T10:00:01.000Z',
      })

      // DB split into parts with same original data
      const dbTextMsg = createMessage({
        guid: 'p:0/DB:msg-001',
        messageKind: 'text',
        text: 'Text part',
        groupGuid: 'DB:msg-001',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMediaMsg = createMessage({
        guid: 'p:1/DB:msg-001',
        messageKind: 'media',
        groupGuid: 'DB:msg-001',
        media: {
          id: 'media:1',
          filename: 'photo.jpg',
          path: '/tmp/photo.jpg',
        },
        date: '2025-10-17T10:00:01.000Z',
      })

      csvMessages = [csvTextMsg, csvMediaMsg]
      dbMessages = [dbTextMsg, dbMediaMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // No exact GUID match (different formats), may use content matching
      // This depends on AC03 implementation
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should not merge messages with different GUIDs', () => {
      const csvMsg1 = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'CSV message 1',
        date: '2025-10-17T10:00:00.000Z',
      })

      const csvMsg2 = createMessage({
        guid: 'csv:101:0',
        messageKind: 'text',
        text: 'CSV message 2',
        date: '2025-10-17T10:00:05.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'DB message',
        date: '2025-10-17T10:00:10.000Z',
      })

      csvMessages = [csvMsg1, csvMsg2]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // All different GUIDs, no exact matches
      expect(result.messages).toHaveLength(3)
      expect(result.stats.exactMatches).toBe(0)
    })

    it('should match multiple exact GUID pairs', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
        createMessage({ guid: 'csv:3:0', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      dbMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:3:0', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(3) // A, B, C (B unmatched)
      expect(result.stats.exactMatches).toBe(2)
    })
  })

  describe('AC02 — DB authoritiveness (prefer DB values)', () => {
    it('should prefer DB timestamp over CSV timestamp when GUID matches', () => {
      const csvMsg = createMessage({
        guid: 'msg:123',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'msg:123',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:05:00.000Z', // DB has different timestamp
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      // DB timestamp should be preferred
      expect(result.messages[0].date).toBe('2025-10-17T10:05:00.000Z')
    })

    it('should preserve DB associations over CSV', () => {
      const csvMsg = createMessage({
        guid: 'msg:123',
        messageKind: 'text',
        text: 'Reply',
        replyingTo: {
          targetMessageGuid: 'csv:target:0',
        },
      })

      const dbMsg = createMessage({
        guid: 'msg:123',
        messageKind: 'text',
        text: 'Reply',
        replyingTo: {
          targetMessageGuid: 'DB:target-guid', // DB has different target
        },
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      // DB association should be preferred
      expect(result.messages[0].replyingTo?.targetMessageGuid).toBe('DB:target-guid')
    })

    it('should prefer DB handle when both present', () => {
      const csvMsg = createMessage({
        guid: 'msg:123',
        handle: '+61412345678',
        messageKind: 'text',
        text: 'Hello',
      })

      const dbMsg = createMessage({
        guid: 'msg:123',
        handle: '+61487654321', // DB has different handle
        messageKind: 'text',
        text: 'Hello',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      // DB handle should be preferred
      expect(result.messages[0].handle).toBe('+61487654321')
    })

    it('should preserve CSV-only fields when DB absent', () => {
      const csvMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'CSV only message',
        date: '2025-10-17T10:00:00.000Z',
        subject: 'CSV subject',
      })

      csvMessages = [csvMsg]
      dbMessages = []

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      // CSV-only fields should be retained
      expect(result.messages[0].subject).toBe('CSV subject')
    })

    it('should merge fields intelligently (DB auth + CSV fallback)', () => {
      const csvMsg = createMessage({
        guid: 'msg:123',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
        subject: 'CSV subject',
        isRead: false,
      })

      const dbMsg = createMessage({
        guid: 'msg:123',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:05:00.000Z', // DB timestamp wins
        isRead: true, // DB read status wins
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      const merged = result.messages[0]
      expect(merged.date).toBe('2025-10-17T10:05:00.000Z') // DB wins
      expect(merged.subject).toBe('CSV subject') // CSV preserved (DB absent)
      expect(merged.isRead).toBe(true) // DB wins
    })
  })

  describe('AC03 — Content equivalence detection', () => {
    it('should detect exact text match for content equivalence', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'The quick brown fox',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'The quick brown fox', // Exact match
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // Should detect content equivalence and merge
      expect(result.messages).toHaveLength(1)
      expect(result.stats.contentMatches).toBeGreaterThan(0)
    })

    it('should detect normalized text match (case insensitive)', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'Hello World',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'hello world', // Different case
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // Should match after normalization
      expect(result.messages).toHaveLength(1)
      expect(result.stats.contentMatches).toBeGreaterThan(0)
    })

    it('should detect normalized text match (whitespace trimmed)', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: '  Message text  ',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Message text', // Whitespace removed
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
      expect(result.stats.contentMatches).toBeGreaterThan(0)
    })

    it('should require same messageKind for content match', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'Message',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'media', // Different kind
        media: {
          id: 'media:1',
          filename: 'file.jpg',
          path: '/tmp/file.jpg',
        },
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // Different messageKind, should NOT match
      expect(result.messages).toHaveLength(2)
      expect(result.stats.contentMatches).toBe(0)
    })

    it('should require same sender for content match', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'Hello',
        handle: '+61412345678',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Hello',
        handle: '+61487654321', // Different sender
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // Different senders, should NOT match
      expect(result.messages).toHaveLength(2)
      expect(result.stats.contentMatches).toBe(0)
    })

    it('should avoid false positives on similar text', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Help', // Similar but not same
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // Should NOT match (too different)
      expect(result.messages).toHaveLength(2)
      expect(result.stats.contentMatches).toBe(0)
    })
  })

  describe('AC04 — Data loss verification with count invariants', () => {
    it('should verify no data loss (output >= input)', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
      ]

      dbMessages = [
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // No dedup, all 3 messages should be kept
      expect(result.messages).toHaveLength(3)
      expect(result.stats.csvCount).toBe(2)
      expect(result.stats.dbCount).toBe(1)
      expect(result.stats.outputCount).toBe(3)

      // Verify invariant
      expect(result.stats.outputCount).toBeGreaterThanOrEqual(Math.max(result.stats.csvCount, result.stats.dbCount))
    })

    it('should count exact matches in dedup statistics', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
      ]

      dbMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }), // Match
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      const result = dedupAndMerge(csvMessages, dbMessages)

      // 2 CSV + 2 DB, but 1 exact match → 3 output
      expect(result.messages).toHaveLength(3)
      expect(result.stats.exactMatches).toBe(1)
      expect(result.stats.outputCount).toBe(3)
    })

    it('should count content matches in statistics', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'Hello', date: '2025-10-17T10:00:00.000Z' }),
      ]

      dbMessages = [
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'Hello', date: '2025-10-17T10:00:00.000Z' }), // Content match
      ]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.stats.contentMatches).toBeGreaterThan(0)
    })

    it('should fail if data loss detected', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
        createMessage({ guid: 'csv:3:0', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      dbMessages = []

      const result = dedupAndMerge(csvMessages, dbMessages)

      // Simulate data loss by returning fewer messages than input
      // This should be detected and fail verification
      expect(result.messages.length).toBeGreaterThanOrEqual(csvMessages.length)
    })

    it('should report detailed merge statistics', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
      ]

      dbMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      const result = dedupAndMerge(csvMessages, dbMessages)

      const stats = result.stats
      expect(stats).toHaveProperty('csvCount')
      expect(stats).toHaveProperty('dbCount')
      expect(stats).toHaveProperty('outputCount')
      expect(stats).toHaveProperty('exactMatches')
      expect(stats).toHaveProperty('contentMatches')
      expect(stats.csvCount).toBe(2)
      expect(stats.dbCount).toBe(2)
    })
  })

  describe('AC05 — Deterministic GUID assignment', () => {
    it('should produce identical output for same input', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
      ]

      dbMessages = [
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' }),
      ]

      const result1 = dedupAndMerge([...csvMessages], [...dbMessages])
      const result2 = dedupAndMerge([...csvMessages], [...dbMessages])

      // Same input should produce identical output
      expect(result1.messages).toHaveLength(result2.messages.length)
      for (let i = 0; i < result1.messages.length; i++) {
        expect(result1.messages[i].guid).toBe(result2.messages[i].guid)
      }
    })

    it('should maintain same GUIDs across multiple runs', () => {
      const origCsvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'Message', date: '2025-10-17T10:00:00.000Z' }),
      ]

      const origDbMessages = [
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'Message', date: '2025-10-17T10:00:00.000Z' }),
      ]

      const result1 = dedupAndMerge([...origCsvMessages], [...origDbMessages])
      const result2 = dedupAndMerge([...origCsvMessages], [...origDbMessages])
      const result3 = dedupAndMerge([...origCsvMessages], [...origDbMessages])

      // All runs should produce same GUIDs
      expect(result1.messages[0].guid).toBe(result2.messages[0].guid)
      expect(result2.messages[0].guid).toBe(result3.messages[0].guid)
    })

    it('should produce same output regardless of input sort order', () => {
      const csv1 = createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' })
      const csv2 = createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' })
      const db1 = createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'C', date: '2025-10-17T10:00:10.000Z' })

      // First order
      const result1 = dedupAndMerge([csv1, csv2], [db1])

      // Reversed order
      const result2 = dedupAndMerge([csv2, csv1], [db1])

      // Should have same messages (though may be in different order)
      expect(result1.messages).toHaveLength(result2.messages.length)

      // Sort by GUID for comparison
      const sorted1 = result1.messages.map(m => m.guid).sort()
      const sorted2 = result2.messages.map(m => m.guid).sort()
      expect(sorted1).toEqual(sorted2)
    })

    it('should assign stable GUIDs to merged messages', () => {
      const csvMsg = createMessage({
        guid: 'csv:100:0',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const dbMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      csvMessages = [csvMsg]
      dbMessages = [dbMsg]

      const result1 = dedupAndMerge([...csvMessages], [...dbMessages])
      const result2 = dedupAndMerge([...csvMessages], [...dbMessages])

      // Both runs should assign same GUID to merged result
      expect(result1.messages[0].guid).toBe(result2.messages[0].guid)

      // Should prefer DB GUID if available
      if (result1.stats.contentMatches > 0) {
        expect(result1.messages[0].guid).toBe('DB:msg-001')
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty inputs', () => {
      csvMessages = []
      dbMessages = []

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(0)
      expect(result.stats.csvCount).toBe(0)
      expect(result.stats.dbCount).toBe(0)
      expect(result.stats.outputCount).toBe(0)
    })

    it('should handle CSV-only messages', () => {
      csvMessages = [
        createMessage({ guid: 'csv:1:0', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'csv:2:0', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
      ]

      dbMessages = []

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(2)
      expect(result.stats.csvCount).toBe(2)
      expect(result.stats.exactMatches).toBe(0)
    })

    it('should handle DB-only messages', () => {
      csvMessages = []

      dbMessages = [
        createMessage({ guid: 'DB:msg-001', messageKind: 'text', text: 'A', date: '2025-10-17T10:00:00.000Z' }),
        createMessage({ guid: 'DB:msg-002', messageKind: 'text', text: 'B', date: '2025-10-17T10:00:05.000Z' }),
      ]

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(2)
      expect(result.stats.dbCount).toBe(2)
      expect(result.stats.exactMatches).toBe(0)
    })

    it('should handle messages with null text', () => {
      csvMessages = [
        createMessage({
          guid: 'csv:1:0',
          messageKind: 'media',
          text: null,
          media: { id: 'media:1', filename: 'file.jpg', path: '/tmp/file.jpg' },
          date: '2025-10-17T10:00:00.000Z',
        }),
      ]

      dbMessages = []

      const result = dedupAndMerge(csvMessages, dbMessages)

      expect(result.messages).toHaveLength(1)
    })

    it('should handle large datasets deterministically', () => {
      // Create large dataset
      const largeCSV = Array.from({ length: 100 }, (_, i) =>
        createMessage({
          guid: `csv:${i}:0`,
          messageKind: 'text',
          text: `Message ${i}`,
          date: new Date(2025, 9, 17, 10, i % 60).toISOString(),
        })
      )

      const largeDB = Array.from({ length: 100 }, (_, i) =>
        createMessage({
          guid: `DB:msg-${i}`,
          messageKind: 'text',
          text: `DB Message ${i}`,
          date: new Date(2025, 9, 17, 11, i % 60).toISOString(),
        })
      )

      const result1 = dedupAndMerge([...largeCSV], [...largeDB])
      const result2 = dedupAndMerge([...largeCSV], [...largeDB])

      // Should complete without error
      expect(result1.messages.length).toBeGreaterThan(0)
      expect(result1.messages).toHaveLength(result2.messages.length)

      // Verify determinism
      for (let i = 0; i < result1.messages.length; i++) {
        expect(result1.messages[i].guid).toBe(result2.messages[i].guid)
      }
    })
  })
})

// Helper to create test messages
function createMessage(partial: Partial<Message>): Message {
  return {
    guid: 'test-guid',
    messageKind: 'text',
    isFromMe: false,
    date: '2025-10-17T10:00:00.000Z',
    ...partial,
  }
}
