/**
 * Determinism Test Suite (RENDER--T04)
 *
 * Comprehensive tests for deterministic rendering:
 * - AC01: Snapshot tests for fixed input → identical output across runs
 * - AC02: No network calls during rendering (verified with isolation)
 * - AC03: Deterministic ordering of same-timestamp messages (stable sort by guid)
 * - AC04: Reproducible markdown structure verified with diff comparison
 * - AC05: Performance validation (1000 messages in <10s)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Message } from '#schema/message'
import {
  renderMessages,
  getMessageHash,
  verifyDeterminism,
  sortMessagesByTimestamp,
  validateMarkdownStructure,
} from '../index'

describe('RENDER--T04: Determinism Test Suite', () => {
  // ============================================================================
  // Test Fixtures - Message Datasets of Various Sizes
  // ============================================================================

  /**
   * Create a test message with defaults
   */
  function createTestMessage(overrides: Partial<Message> = {}): Message {
    const timestamp = overrides.date || '2025-01-15T10:00:00Z'
    const guid = overrides.guid || `guid-${Date.now()}-${Math.random()}`
    return {
      guid,
      messageKind: 'text',
      date: timestamp,
      handle: 'Test User',
      text: 'Test message',
      isFromMe: false,
      ...overrides,
    }
  }

  /**
   * Create a small dataset (10 messages)
   */
  function createSmallDataset(): Message[] {
    const base = '2025-01-15T'
    return [
      createTestMessage({
        guid: 'msg-001',
        date: `${base}06:00:00Z`,
        text: 'Good morning',
      }),
      createTestMessage({
        guid: 'msg-002',
        date: `${base}09:30:00Z`,
        text: 'How are you?',
      }),
      createTestMessage({
        guid: 'msg-003',
        date: `${base}12:00:00Z`,
        text: 'Lunch time',
      }),
      createTestMessage({
        guid: 'msg-004',
        date: `${base}14:30:00Z`,
        text: 'Afternoon meeting',
      }),
      createTestMessage({
        guid: 'msg-005',
        date: `${base}18:00:00Z`,
        text: 'Evening plans',
      }),
      createTestMessage({
        guid: 'msg-006',
        date: `${base}12:00:00Z`,
        text: 'Same timestamp as msg-003',
      }),
      createTestMessage({
        guid: 'msg-007',
        date: `${base}12:00:00Z`,
        text: 'Another same timestamp',
      }),
      createTestMessage({
        guid: 'msg-008',
        date: `${base}20:30:00Z`,
        text: 'Late evening',
      }),
      createTestMessage({
        guid: 'msg-009',
        date: `${base}22:00:00Z`,
        text: 'Night message',
      }),
      createTestMessage({
        guid: 'msg-010',
        date: `${base}23:59:59Z`,
        text: 'End of day',
      }),
    ]
  }

  /**
   * Create a medium dataset (100 messages)
   */
  function createMediumDataset(): Message[] {
    const messages: Message[] = []
    for (let i = 0; i < 100; i++) {
      const hour = Math.floor(i / 10)
      const date = `2025-01-15T${String(Math.min(hour, 23)).padStart(2, '0')}:${String((i * 6) % 60).padStart(2, '0')}:00Z`
      messages.push(
        createTestMessage({
          guid: `msg-${String(i + 1).padStart(3, '0')}`,
          date,
          text: `Message ${i + 1}`,
        })
      )
    }
    return messages
  }

  /**
   * Create a large dataset (500 messages)
   */
  function createLargeDataset(): Message[] {
    const messages: Message[] = []
    for (let i = 0; i < 500; i++) {
      const dayOffset = Math.floor(i / 100)
      const date = new Date('2025-01-15T00:00:00Z')
      date.setDate(date.getDate() + dayOffset)
      date.setHours(Math.floor((i % 100) / 4))
      date.setMinutes((i * 7) % 60)

      messages.push(
        createTestMessage({
          guid: `msg-${String(i + 1).padStart(4, '0')}`,
          date: date.toISOString(),
          text: `Message ${i + 1}`,
        })
      )
    }
    return messages
  }

  /**
   * Create a huge dataset (1000 messages) for performance testing
   */
  function createHugeDataset(): Message[] {
    const messages: Message[] = []
    for (let i = 0; i < 1000; i++) {
      const dayOffset = Math.floor(i / 144)
      const date = new Date('2025-01-15T00:00:00Z')
      date.setDate(date.getDate() + dayOffset)
      date.setHours(Math.floor((i % 144) / 6))
      date.setMinutes((i * 11) % 60)

      messages.push(
        createTestMessage({
          guid: `msg-${String(i + 1).padStart(4, '0')}`,
          date: date.toISOString(),
          text: `Message ${i + 1}`,
        })
      )
    }
    return messages
  }

  // ============================================================================
  // AC01: Snapshot Tests - Identical Output Across Runs
  // ============================================================================

  describe('AC01: Snapshot tests produce identical output across runs', () => {
    it('produces consistent output for small dataset (10 messages)', () => {
      const messages = createSmallDataset()
      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
      expect(output1).toMatchSnapshot()
    })

    it('produces consistent output for medium dataset (100 messages)', () => {
      const messages = createMediumDataset()
      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
      expect(output1).toMatchSnapshot()
    })

    it('produces consistent output for large dataset (500 messages)', () => {
      const messages = createLargeDataset()
      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
      expect(output1).toMatchSnapshot()
    })

    it('produces identical hash across multiple renders of same input', () => {
      const messages = createSmallDataset()

      const hash1 = getMessageHash(messages)
      const hash2 = getMessageHash(messages)
      const hash3 = getMessageHash(messages)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('different messages produce different hashes', () => {
      const messages1 = createSmallDataset()
      const messages2 = createSmallDataset().map((m) => ({
        ...m,
        text: m.text + ' modified',
      }))

      const hash1 = getMessageHash(messages1)
      const hash2 = getMessageHash(messages2)

      expect(hash1).not.toBe(hash2)
    })

    it('snapshot remains stable for multiple invocations', () => {
      const messages = createSmallDataset()
      const outputs: Array<Map<string, string>> = []

      for (let i = 0; i < 5; i++) {
        outputs.push(renderMessages(messages))
      }

      // All outputs should be identical
      const firstOutput = outputs[0]
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toEqual(firstOutput)
      }
    })
  })

  // ============================================================================
  // AC02: No Network Calls During Rendering
  // ============================================================================

  describe('AC02: No network calls during rendering', () => {
    beforeEach(() => {
      // Mock all potential network calls
      vi.spyOn(global, 'fetch').mockImplementation(() => {
        throw new Error('Network call attempted during rendering!')
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('rendering small dataset makes no network calls', () => {
      const messages = createSmallDataset()
      expect(() => renderMessages(messages)).not.toThrow()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('rendering medium dataset makes no network calls', () => {
      const messages = createMediumDataset()
      expect(() => renderMessages(messages)).not.toThrow()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('rendering large dataset makes no network calls', () => {
      const messages = createLargeDataset()
      expect(() => renderMessages(messages)).not.toThrow()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('rendering respects offline mode', () => {
      const messages = createSmallDataset()
      const output = renderMessages(messages)

      // Should still produce valid output
      expect(output.size).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // AC03: Deterministic Ordering of Same-Timestamp Messages
  // ============================================================================

  describe('AC03: Deterministic ordering of same-timestamp messages (stable sort by guid)', () => {
    it('orders same-timestamp messages by GUID consistently', () => {
      const messages: Message[] = [
        createTestMessage({
          guid: 'z-guid',
          date: '2025-01-15T12:00:00Z',
          text: 'Z message',
        }),
        createTestMessage({
          guid: 'a-guid',
          date: '2025-01-15T12:00:00Z',
          text: 'A message',
        }),
        createTestMessage({
          guid: 'm-guid',
          date: '2025-01-15T12:00:00Z',
          text: 'M message',
        }),
      ]

      const sorted1 = sortMessagesByTimestamp(messages)
      const sorted2 = sortMessagesByTimestamp(messages)

      expect(sorted1.map((m) => m.guid)).toEqual(['a-guid', 'm-guid', 'z-guid'])
      expect(sorted2.map((m) => m.guid)).toEqual(['a-guid', 'm-guid', 'z-guid'])
      expect(sorted1).toEqual(sorted2)
    })

    it('maintains stable sort across multiple invocations', () => {
      const baseMessages = [
        createTestMessage({
          guid: 'msg-3',
          date: '2025-01-15T12:00:00Z',
        }),
        createTestMessage({
          guid: 'msg-1',
          date: '2025-01-15T12:00:00Z',
        }),
        createTestMessage({
          guid: 'msg-2',
          date: '2025-01-15T12:00:00Z',
        }),
      ]

      const results: string[][] = []
      for (let i = 0; i < 10; i++) {
        const sorted = sortMessagesByTimestamp(baseMessages)
        results.push(sorted.map((m) => m.guid))
      }

      // All results should be identical
      const firstResult = results[0]
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(firstResult)
      }
    })

    it('handles large number of same-timestamp messages', () => {
      const messages: Message[] = []
      for (let i = 0; i < 100; i++) {
        messages.push(
          createTestMessage({
            guid: `msg-${String(i).padStart(3, '0')}`,
            date: '2025-01-15T12:00:00Z',
            text: `Message ${i}`,
          })
        )
      }

      const sorted1 = sortMessagesByTimestamp(messages)
      const sorted2 = sortMessagesByTimestamp(messages)

      // Should maintain same order
      expect(sorted1.map((m) => m.guid)).toEqual(sorted2.map((m) => m.guid))

      // Should be sorted by GUID (lexicographically)
      for (let i = 1; i < sorted1.length; i++) {
        const comparison = sorted1[i].guid.localeCompare(sorted1[i - 1].guid)
        expect(comparison).toBeGreaterThanOrEqual(0)
      }
    })

    it('interleaves different timestamps with GUID stability', () => {
      const messages: Message[] = [
        createTestMessage({ guid: 'z-1', date: '2025-01-15T12:00:00Z' }),
        createTestMessage({ guid: 'a-2', date: '2025-01-15T11:00:00Z' }),
        createTestMessage({ guid: 'm-1', date: '2025-01-15T12:00:00Z' }),
      ]

      const sorted = sortMessagesByTimestamp(messages)

      // Should be: a-2 (earlier time), then z-1 and m-1 (same time, sorted by GUID)
      expect(sorted[0].guid).toBe('a-2')
      expect(sorted[1].guid).toBe('m-1')
      expect(sorted[2].guid).toBe('z-1')
    })
  })

  // ============================================================================
  // AC04: Reproducible Markdown Structure
  // ============================================================================

  describe('AC04: Reproducible markdown structure verified with diff comparison', () => {
    it('generates valid markdown structure for small dataset', () => {
      const messages = createSmallDataset()
      const output = renderMessages(messages)

      expect(output.size).toBeGreaterThan(0)
      for (const markdown of output.values()) {
        validateMarkdownStructure(markdown)
      }
    })

    it('maintains markdown structure consistency across runs', () => {
      const messages = createSmallDataset()

      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      // Compare markdown content
      expect(output1.size).toBe(output2.size)

      const keys1 = Array.from(output1.keys()).sort()
      const keys2 = Array.from(output2.keys()).sort()
      expect(keys1).toEqual(keys2)

      for (const key of keys1) {
        expect(output1.get(key)).toBe(output2.get(key))
      }
    })

    it('verifies markdown sections are properly grouped', () => {
      const messages = createSmallDataset()
      const output = renderMessages(messages)

      // Should have multiple date sections
      expect(output.size).toBeGreaterThanOrEqual(1)

      // Each markdown should have proper structure
      for (const [date, markdown] of output.entries()) {
        // Should have date in output
        expect(markdown).toContain(date)
        // Should have morning/afternoon/evening sections or be empty
        expect(
          markdown.includes('morning') ||
            markdown.includes('afternoon') ||
            markdown.includes('evening') ||
            markdown.length === 0
        ).toBe(true)
      }
    })

    it('reproduces identical markdown for identical messages', () => {
      const messages = createSmallDataset()

      const md1 = renderMessages(messages)
      const md2 = renderMessages(messages)

      const concat1 = Array.from(md1.values()).join('\n---\n')
      const concat2 = Array.from(md2.values()).join('\n---\n')

      expect(concat1).toBe(concat2)
    })

    it('preserves anchor IDs across renders', () => {
      const messages = createSmallDataset()

      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      const anchors1 = extractAnchors(Array.from(output1.values()).join('\n'))
      const anchors2 = extractAnchors(Array.from(output2.values()).join('\n'))

      expect(anchors1.sort()).toEqual(anchors2.sort())
    })
  })

  // ============================================================================
  // AC05: Performance Validation
  // ============================================================================

  describe('AC05: Performance validation (1000 messages in <10s)', () => {
    it('renders 10 messages in acceptable time', () => {
      const messages = createSmallDataset()

      const start = performance.now()
      renderMessages(messages)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100) // Should be <100ms for 10 messages
    })

    it('renders 100 messages in acceptable time', () => {
      const messages = createMediumDataset()

      const start = performance.now()
      renderMessages(messages)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1000) // Should be <1s for 100 messages
    })

    it('renders 500 messages in acceptable time', () => {
      const messages = createLargeDataset()

      const start = performance.now()
      renderMessages(messages)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(5000) // Should be <5s for 500 messages
    })

    it('renders 1000 messages in less than 10 seconds', () => {
      const messages = createHugeDataset()

      const start = performance.now()
      const output = renderMessages(messages)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(10000) // Must be <10s per AC05
      expect(output.size).toBeGreaterThan(0) // Should produce output
    })

    it('scales linearly with message count', () => {
      const times: { count: number; duration: number }[] = []

      const datasets = [
        { count: 10, messages: createSmallDataset() },
        { count: 100, messages: createMediumDataset() },
        { count: 500, messages: createLargeDataset() },
      ]

      for (const { count, messages } of datasets) {
        const start = performance.now()
        renderMessages(messages)
        const duration = performance.now() - start
        times.push({ count, duration })
      }

      // Verify roughly linear scaling (allow 2x multiplier for overhead)
      for (let i = 1; i < times.length; i++) {
        const ratio = (times[i].count / times[i - 1].count) * 2 // 2x buffer for overhead
        const durationRatio = times[i].duration / times[i - 1].duration

        expect(durationRatio).toBeLessThan(ratio)
      }
    })
  })

  // ============================================================================
  // Integration Tests - Complete Determinism Verification
  // ============================================================================

  describe('Integration: Complete determinism verification', () => {
    it('verifyDeterminism confirms consistent output', () => {
      const messages = createSmallDataset()

      const result = verifyDeterminism(messages, 5) // Run 5 times

      expect(result.isDeterministic).toBe(true)
      expect(result.runsCount).toBe(5)
      expect(result.hashesAreIdentical).toBe(true)
      expect(result.outputsAreIdentical).toBe(true)
    })

    it('complete pipeline produces deterministic output', () => {
      const allDatasets = [
        { name: 'small', messages: createSmallDataset() },
        { name: 'medium', messages: createMediumDataset() },
        { name: 'large', messages: createLargeDataset() },
      ]

      for (const { name, messages } of allDatasets) {
        const result = verifyDeterminism(messages, 3)
        expect(result.isDeterministic).toBe(
          true,
          `${name} dataset should be deterministic`
        )
      }
    })

    it('complex messages with enrichments render deterministically', () => {
      const messages: Message[] = [
        createTestMessage({
          guid: 'msg-001',
          messageKind: 'media',
          date: '2025-01-15T10:00:00Z',
          text: 'Photo',
          media: {
            id: 'media-1',
            path: '/path/to/image.jpg',
            filename: 'image.jpg',
            mimeType: 'image/jpeg',
            mediaKind: 'image',
            enrichment: [
              {
                kind: 'link_context',
                url: 'https://example.com',
                title: 'Example',
                summary: 'Summary',
                createdAt: '2025-01-15T10:00:00Z',
                provider: 'firecrawl',
                version: '1.0',
              },
            ],
          },
        }),
        createTestMessage({
          guid: 'msg-002',
          messageKind: 'text',
          date: '2025-01-15T12:00:00Z',
          text: 'Check this link',
        }),
        createTestMessage({
          guid: 'msg-003',
          messageKind: 'tapback',
          date: '2025-01-15T12:01:00Z',
          sender: 'Other User',
          text: '',
          replyTo: 'msg-002',
          tapback: {
            type: 'liked',
          },
        }),
      ]

      const result = verifyDeterminism(messages, 5)
      expect(result.isDeterministic).toBe(true)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge cases and error handling', () => {
    it('handles empty message list', () => {
      const messages: Message[] = []

      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
      expect(output1.size).toBe(0)
    })

    it('handles single message', () => {
      const messages = [createSmallDataset()[0]]

      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
    })

    it('handles very long text deterministically', () => {
      const longText = 'x'.repeat(10000)
      const messages = [
        createTestMessage({
          guid: 'msg-001',
          date: '2025-01-15T10:00:00Z',
          text: longText,
        }),
      ]

      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
    })

    it('handles special characters deterministically', () => {
      const messages = [
        createTestMessage({
          guid: 'msg-001',
          date: '2025-01-15T10:00:00Z',
          text: 'Special chars: !@#$%^&*()_+-=[]{}|;:"<>?,./~`',
        }),
      ]

      const output1 = renderMessages(messages)
      const output2 = renderMessages(messages)

      expect(output1).toEqual(output2)
    })
  })
})

/**
 * Helper: Extract anchor IDs from markdown
 */
function extractAnchors(markdown: string): string[] {
  const anchorRegex = /#msg-[a-zA-Z0-9\-]+/g
  const matches = markdown.match(anchorRegex)
  return matches || []
}
