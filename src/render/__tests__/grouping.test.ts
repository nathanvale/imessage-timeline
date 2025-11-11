import { describe, it, expect, beforeEach } from 'vitest'

import {
  groupMessagesByDateAndTimeOfDay,
  generateAnchorId,
  classifyTimeOfDay,
  sortByTimestamp,
  type GroupedMessages,
  type TimeOfDayGroup,
} from '../grouping'

import type { Message } from '#schema/message'

describe('RENDER--T01: Grouping and Anchor Generation', () => {
  describe('AC01: Group messages by date (YYYY-MM-DD)', () => {
    it('should group messages by date into separate structures', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:30:00.000Z',
          text: 'Morning message',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T14:30:00.000Z',
          text: 'Afternoon message',
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-18T10:30:00.000Z',
          text: 'Next day message',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      // Should have 2 date groups
      expect(Object.keys(grouped)).toHaveLength(2)
      expect(grouped['2025-10-17']).toBeDefined()
      expect(grouped['2025-10-18']).toBeDefined()
    })

    it('should format dates as YYYY-MM-DD', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T23:59:59.999Z',
          text: 'Late night',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)
      const dateKey = Object.keys(grouped)[0]

      expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(dateKey).toBe('2025-10-17')
    })

    it('should handle messages from different dates correctly', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-16T15:00:00.000Z',
          text: 'Oct 16',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T15:00:00.000Z',
          text: 'Oct 17',
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-18T15:00:00.000Z',
          text: 'Oct 18',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      expect(Object.keys(grouped)).toHaveLength(3)
      expect(grouped['2025-10-16']).toBeDefined()
      expect(grouped['2025-10-17']).toBeDefined()
      expect(grouped['2025-10-18']).toBeDefined()
    })

    it('should handle UTC timestamps correctly', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T00:00:00.000Z',
          text: 'Start of day UTC',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T23:59:59.999Z',
          text: 'End of day UTC',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      expect(Object.keys(grouped)).toHaveLength(1)
      expect(grouped['2025-10-17']).toBeDefined()
    })
  })

  describe('AC02: Sub-group by time-of-day (Morning/Afternoon/Evening)', () => {
    it('should classify Morning (00:00-11:59)', () => {
      const timeOfDay = classifyTimeOfDay('2025-10-17T06:30:00.000Z')
      expect(timeOfDay).toBe('morning')
    })

    it('should classify Afternoon (12:00-17:59)', () => {
      const timeOfDay = classifyTimeOfDay('2025-10-17T14:30:00.000Z')
      expect(timeOfDay).toBe('afternoon')
    })

    it('should classify Evening (18:00-23:59)', () => {
      const timeOfDay = classifyTimeOfDay('2025-10-17T20:30:00.000Z')
      expect(timeOfDay).toBe('evening')
    })

    it('should handle boundary times correctly', () => {
      expect(classifyTimeOfDay('2025-10-17T00:00:00.000Z')).toBe('morning')
      expect(classifyTimeOfDay('2025-10-17T11:59:59.999Z')).toBe('morning')
      expect(classifyTimeOfDay('2025-10-17T12:00:00.000Z')).toBe('afternoon')
      expect(classifyTimeOfDay('2025-10-17T17:59:59.999Z')).toBe('afternoon')
      expect(classifyTimeOfDay('2025-10-17T18:00:00.000Z')).toBe('evening')
      expect(classifyTimeOfDay('2025-10-17T23:59:59.999Z')).toBe('evening')
    })

    it('should sub-group messages by time-of-day within each date', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T06:00:00.000Z',
          text: 'Morning',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T14:00:00.000Z',
          text: 'Afternoon',
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T20:00:00.000Z',
          text: 'Evening',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)
      const dateGroup = grouped['2025-10-17']

      expect(dateGroup.morning).toHaveLength(1)
      expect(dateGroup.afternoon).toHaveLength(1)
      expect(dateGroup.evening).toHaveLength(1)

      expect(dateGroup.morning[0].guid).toBe('msg-1')
      expect(dateGroup.afternoon[0].guid).toBe('msg-2')
      expect(dateGroup.evening[0].guid).toBe('msg-3')
    })

    it('should handle multiple messages in same time-of-day', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T08:00:00.000Z',
          text: 'Morning 1',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T09:30:00.000Z',
          text: 'Morning 2',
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T06:00:00.000Z',
          text: 'Morning 3',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)
      const dateGroup = grouped['2025-10-17']

      expect(dateGroup.morning).toHaveLength(3)
    })
  })

  describe('AC03: Generate unique anchor IDs for each message', () => {
    it('should generate anchor ID in format #msg-{guid}', () => {
      const anchor = generateAnchorId('DB:XYZ-123')
      expect(anchor).toBe('#msg-DB:XYZ-123')
    })

    it('should create unique anchor for each unique GUID', () => {
      const anchor1 = generateAnchorId('guid-1')
      const anchor2 = generateAnchorId('guid-2')

      expect(anchor1).not.toBe(anchor2)
      expect(anchor1).toBe('#msg-guid-1')
      expect(anchor2).toBe('#msg-guid-2')
    })

    it('should handle various GUID formats', () => {
      const guids = ['simple-guid', 'DB:complex-guid-123', 'p:0/parent-guid', 'abc123def456']

      guids.forEach((guid) => {
        const anchor = generateAnchorId(guid)
        expect(anchor).toMatch(/^#msg-.+$/)
        expect(anchor).toContain(guid)
      })
    })

    it('should preserve GUID integrity in anchor', () => {
      const guid = 'p:1/DB:parent-guid-123'
      const anchor = generateAnchorId(guid)
      expect(anchor).toBe(`#msg-${guid}`)
    })

    it('should be deterministic (same GUID = same anchor)', () => {
      const guid = 'test-guid'
      const anchor1 = generateAnchorId(guid)
      const anchor2 = generateAnchorId(guid)
      expect(anchor1).toBe(anchor2)
    })
  })

  describe('AC04: Deep-link anchors work in Obsidian', () => {
    it('should generate valid markdown anchor syntax', () => {
      const anchor = generateAnchorId('msg-123')
      // Obsidian accepts anchors with format [text](#anchor-id)
      expect(anchor).toMatch(/^#[a-zA-Z0-9:/_-]+$/)
    })

    it('should handle colon in GUID (common in part GUIDs)', () => {
      const guid = 'p:0/DB:guid'
      const anchor = generateAnchorId(guid)
      // Colons are valid in markdown anchors
      expect(anchor).toContain(':')
      expect(anchor).toBe('#msg-p:0/DB:guid')
    })

    it('should handle forward slash in GUID (part splitting)', () => {
      const guid = 'p:1/parent-guid'
      const anchor = generateAnchorId(guid)
      // Forward slashes are valid in markdown anchors
      expect(anchor).toContain('/')
      expect(anchor).toBe('#msg-p:1/parent-guid')
    })

    it('should produce valid Obsidian-compatible anchors', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:30:00.000Z',
          text: 'Test',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)
      const dateGroup = grouped['2025-10-17']
      const message = dateGroup.morning[0]
      const anchor = generateAnchorId(message.guid)

      // Should be clickable in markdown
      expect(anchor).toMatch(/^#[a-zA-Z0-9:/_-]+$/)
    })

    it('should support deep linking format [text](#anchor)', () => {
      const guid = 'msg-123'
      const anchor = generateAnchorId(guid)
      const linkMarkdown = `[Link](#${anchor.slice(1)})`
      // Remove # from anchor for link reference
      expect(linkMarkdown).toContain('[Link](#msg-msg-123)')
    })
  })

  describe('AC05: Maintain chronological ordering within time-of-day groups', () => {
    it('should sort messages by timestamp within time-of-day', () => {
      const messages: Message[] = [
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T08:30:00.000Z',
          text: 'Third',
        },
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T08:00:00.000Z',
          text: 'First',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T08:15:00.000Z',
          text: 'Second',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)
      const sorted = grouped['2025-10-17'].morning

      expect(sorted[0].guid).toBe('msg-1')
      expect(sorted[1].guid).toBe('msg-2')
      expect(sorted[2].guid).toBe('msg-3')
    })

    it('should maintain chronological order with millisecond precision', () => {
      const messages: Message[] = [
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:00:00.100Z',
          text: 'Message 2',
        },
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:00:00.050Z',
          text: 'Message 1',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)
      const sorted = grouped['2025-10-17'].morning

      expect(sorted[0].guid).toBe('msg-1')
      expect(sorted[1].guid).toBe('msg-2')
    })

    it('should handle large number of messages in order', () => {
      const messages: Message[] = Array.from({ length: 100 }, (_, i) => {
        // Create 100 messages all on 2025-10-17, with 2-minute spacing
        const ms = 1696 + i * 2 * 60 * 1000 // Start at some minute, add 2 mins per msg
        const date = new Date(ms * 1000).toISOString()
        return {
          guid: `msg-${i}`,
          messageKind: 'text' as const,
          isFromMe: false,
          date: `2025-10-17T10:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}.000Z`,
          text: `Message ${i}`,
        }
      })

      const shuffled = [...messages].reverse()
      const grouped = groupMessagesByDateAndTimeOfDay(shuffled)
      const dateGroup = grouped['2025-10-17']

      expect(dateGroup).toBeDefined()

      // All messages should be in morning (10:xx)
      const sorted = dateGroup.morning

      for (let i = 1; i < sorted.length; i++) {
        const prevTime = new Date(sorted[i - 1].date).getTime()
        const currTime = new Date(sorted[i].date).getTime()
        expect(currTime).toBeGreaterThanOrEqual(prevTime)
      }
    })

    it('should maintain order across different dates', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:30:00.000Z',
          text: 'Oct 17',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-18T08:00:00.000Z',
          text: 'Oct 18 Morning',
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-18T10:00:00.000Z',
          text: 'Oct 18 Late Morning',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      expect(Object.keys(grouped)).toHaveLength(2)
      expect(grouped['2025-10-17'].morning[0].guid).toBe('msg-1')
      expect(grouped['2025-10-18'].morning[0].guid).toBe('msg-2')
      expect(grouped['2025-10-18'].morning[1].guid).toBe('msg-3')
    })
  })

  describe('Integration: Full grouping flow', () => {
    it('should handle complete realistic message set', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T09:15:00.000Z',
          text: 'Good morning',
        },
        {
          guid: 'msg-2',
          messageKind: 'media',
          isFromMe: true,
          date: '2025-10-17T09:16:00.000Z',
          media: {
            id: 'media-1',
            filename: 'photo.jpg',
            path: '/path/photo.jpg',
          },
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T14:30:00.000Z',
          text: 'Lunch response',
        },
        {
          guid: 'msg-4',
          messageKind: 'tapback',
          isFromMe: true,
          date: '2025-10-17T14:31:00.000Z',
          tapback: {
            type: 'liked',
            action: 'added',
          },
        },
        {
          guid: 'msg-5',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T20:45:00.000Z',
          text: 'Good evening',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      expect(grouped['2025-10-17']).toBeDefined()
      expect(grouped['2025-10-17'].morning).toHaveLength(2)
      expect(grouped['2025-10-17'].afternoon).toHaveLength(2)
      expect(grouped['2025-10-17'].evening).toHaveLength(1)

      // Check ordering within groups
      expect(grouped['2025-10-17'].morning[0].guid).toBe('msg-1')
      expect(grouped['2025-10-17'].morning[1].guid).toBe('msg-2')
      expect(grouped['2025-10-17'].afternoon[0].guid).toBe('msg-3')
      expect(grouped['2025-10-17'].afternoon[1].guid).toBe('msg-4')
      expect(grouped['2025-10-17'].evening[0].guid).toBe('msg-5')
    })

    it('should handle empty message list', () => {
      const grouped = groupMessagesByDateAndTimeOfDay([])
      expect(grouped).toEqual({})
    })

    it('should handle single message', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:00:00.000Z',
          text: 'Single message',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      expect(Object.keys(grouped)).toHaveLength(1)
      expect(grouped['2025-10-17'].morning).toHaveLength(1)
      expect(grouped['2025-10-17'].afternoon).toHaveLength(0)
      expect(grouped['2025-10-17'].evening).toHaveLength(0)
    })

    it('should handle multi-day message set', () => {
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-16T10:00:00.000Z',
          text: 'Day 1',
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:00:00.000Z',
          text: 'Day 2',
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-18T10:00:00.000Z',
          text: 'Day 3',
        },
        {
          guid: 'msg-4',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T20:00:00.000Z',
          text: 'Day 2 Evening',
        },
      ]

      const grouped = groupMessagesByDateAndTimeOfDay(messages)

      expect(Object.keys(grouped)).toHaveLength(3)
      expect(grouped['2025-10-17'].morning[0].guid).toBe('msg-2')
      expect(grouped['2025-10-17'].evening[0].guid).toBe('msg-4')
    })
  })

  describe('Helper functions', () => {
    describe('sortByTimestamp', () => {
      it('should sort messages chronologically', () => {
        const messages: Message[] = [
          {
            guid: 'msg-3',
            messageKind: 'text',
            isFromMe: false,
            date: '2025-10-17T10:30:00.000Z',
            text: '3',
          },
          {
            guid: 'msg-1',
            messageKind: 'text',
            isFromMe: false,
            date: '2025-10-17T10:00:00.000Z',
            text: '1',
          },
          {
            guid: 'msg-2',
            messageKind: 'text',
            isFromMe: false,
            date: '2025-10-17T10:15:00.000Z',
            text: '2',
          },
        ]

        const sorted = sortByTimestamp(messages)

        expect(sorted[0].guid).toBe('msg-1')
        expect(sorted[1].guid).toBe('msg-2')
        expect(sorted[2].guid).toBe('msg-3')
      })

      it('should not mutate original array', () => {
        const messages: Message[] = [
          {
            guid: 'msg-2',
            messageKind: 'text',
            isFromMe: false,
            date: '2025-10-17T10:30:00.000Z',
            text: '2',
          },
          {
            guid: 'msg-1',
            messageKind: 'text',
            isFromMe: false,
            date: '2025-10-17T10:00:00.000Z',
            text: '1',
          },
        ]

        const original = [...messages]
        sortByTimestamp(messages)

        expect(messages).toEqual(original)
      })
    })
  })
})
