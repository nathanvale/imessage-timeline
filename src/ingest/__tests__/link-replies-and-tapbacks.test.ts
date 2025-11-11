import { describe, it, expect, beforeEach } from 'vitest'

import {
  linkRepliesToParents,
  linkTapbacksToParents,
  detectAmbiguousLinks,
} from '../link-replies-and-tapbacks'

import type { Message } from '#lib/schema/message'

/**
 * Test suite for reply and tapback linking (NORMALIZE--T03)
 *
 * AC01: Link replies using DB association_guid as primary method
 * AC02: Apply heuristics for unlinked replies (timestamp proximity <30s, content patterns)
 * AC03: Link tapbacks to parent message GUIDs (including part GUIDs)
 * AC04: Handle ambiguous links with structured logging and tie counters
 * AC05: Maintain parity with CSV linking rules from original analyzer
 */

describe('linkRepliesToParents', () => {
  let messages: Message[]

  beforeEach(() => {
    messages = []
  })

  describe('AC01 — DB association linking (primary method)', () => {
    it('should link replies using associated_message_guid when present', () => {
      const parentMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const replyMsg = createMessage({
        guid: 'DB:msg-002',
        messageKind: 'text',
        text: 'Hi there',
        date: '2025-10-17T10:00:05.000Z',
        replyingTo: {
          targetMessageGuid: 'DB:msg-001', // DB association set
        },
      })

      const result = linkRepliesToParents([parentMsg, replyMsg])

      expect(result[1].replyingTo?.targetMessageGuid).toBe('DB:msg-001')
    })

    it('should resolve part GUIDs like p:1/DB:msg-001 correctly', () => {
      const parentTextMsg = createMessage({
        guid: 'p:0/DB:msg-001',
        messageKind: 'text',
        text: 'Text part',
        groupGuid: 'DB:msg-001',
        date: '2025-10-17T10:00:00.000Z',
      })

      const parentMediaMsg = createMessage({
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

      const replyMsg = createMessage({
        guid: 'DB:msg-002',
        messageKind: 'text',
        text: 'Nice photo',
        date: '2025-10-17T10:00:06.000Z',
        replyingTo: {
          targetMessageGuid: 'p:1/DB:msg-001', // Points to media part
        },
      })

      const result = linkRepliesToParents([parentTextMsg, parentMediaMsg, replyMsg])

      expect(result[2].replyingTo?.targetMessageGuid).toBe('p:1/DB:msg-001')
    })

    it('should prefer DB associations over heuristics', () => {
      const wrongParent = createMessage({
        guid: 'DB:msg-wrong',
        messageKind: 'text',
        text: 'Hello', // Same text snippet
        date: '2025-10-17T10:00:00.000Z',
      })

      const correctParent = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Different',
        date: '2025-10-17T10:05:00.000Z',
      })

      const replyMsg = createMessage({
        guid: 'DB:msg-002',
        messageKind: 'text',
        text: 'Hi there',
        date: '2025-10-17T10:05:05.000Z',
        replyingTo: {
          targetMessageGuid: 'DB:msg-001', // Explicitly set to correct parent
        },
      })

      const result = linkRepliesToParents([wrongParent, correctParent, replyMsg])

      expect(result[2].replyingTo?.targetMessageGuid).toBe('DB:msg-001')
    })
  })

  describe('AC02 — Heuristic linking for unlinked replies', () => {
    it('should link unlinked replies within 30s timestamp proximity', () => {
      const parentMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Question?',
        date: '2025-10-17T10:00:00.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: 'Answer!',
        date: '2025-10-17T10:00:15.000Z', // 15s later
      })

      const result = linkRepliesToParents([parentMsg, replyMsg])

      // Should link because within 30s window
      expect(result[1].replyingTo?.targetMessageGuid).toBe('csv:123:0')
    })

    it('should NOT link replies outside 30s window', () => {
      const parentMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Question?',
        date: '2025-10-17T10:00:00.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: 'Answer!',
        date: '2025-10-17T10:00:35.000Z', // 35s later, outside window
      })

      const result = linkRepliesToParents([parentMsg, replyMsg])

      // Should NOT link because outside 30s window
      expect(result[1].replyingTo?.targetMessageGuid).toBeUndefined()
    })

    it('should score text snippet matches highly', () => {
      const parentMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'The quick brown fox',
        date: '2025-10-17T10:00:00.000Z',
      })

      const anotherMsg = createMessage({
        guid: 'csv:999:0',
        messageKind: 'text',
        text: 'Unrelated',
        date: '2025-10-17T10:00:10.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: '➜ Replying to: "The quick brown fox" \n Yes!',
        date: '2025-10-17T10:00:15.000Z',
      })

      const result = linkRepliesToParents([parentMsg, anotherMsg, replyMsg])

      // Should link to parent with matching snippet
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:123:0')
    })

    it('should rank media-implied replies correctly', () => {
      const mediaMsg = createMessage({
        guid: 'csv:123:1',
        messageKind: 'media',
        media: {
          id: 'media:1',
          filename: 'photo.jpg',
          path: '/tmp/photo.jpg',
        },
        date: '2025-10-17T10:00:01.000Z',
      })

      const textMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:00.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: 'Nice photo!',
        date: '2025-10-17T10:00:10.000Z',
      })

      const result = linkRepliesToParents([textMsg, mediaMsg, replyMsg])

      // Should link to media message (higher score for media-implied replies)
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:123:1')
    })

    it('should handle tie-breaking with nearest prior message', () => {
      const msg1 = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:00.000Z',
      })

      const msg2 = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:05.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: 'Reply',
        date: '2025-10-17T10:00:10.000Z',
      })

      const result = linkRepliesToParents([msg1, msg2, replyMsg])

      // On tie, should pick nearest (msg2)
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:122:0')
    })

    it('should respect same-sender preference when available', () => {
      const msg1 = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Hi from Alice',
        handle: '+61412345678',
        date: '2025-10-17T10:00:00.000Z',
      })

      const msg2 = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: 'Hi from Bob',
        handle: '+61487654321',
        date: '2025-10-17T10:00:05.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: '➜ Replying to Alice\n Reply',
        handle: '+61412345678', // Same sender as msg1
        date: '2025-10-17T10:00:10.000Z',
      })

      const result = linkRepliesToParents([msg1, msg2, replyMsg])

      // Should link to msg1 (same sender)
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:121:0')
    })
  })

  describe('AC03 — Tapback linking', () => {
    it('should link tapbacks to correct parent message by GUID', () => {
      const parentMsg = createMessage({
        guid: 'DB:msg-001',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const tapbackMsg = createMessage({
        guid: 'DB:msg-003',
        messageKind: 'tapback',
        tapback: {
          type: 'loved',
          action: 'added',
          targetMessageGuid: 'DB:msg-001',
        },
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkTapbacksToParents([parentMsg, tapbackMsg])

      expect(result[1].tapback?.targetMessageGuid).toBe('DB:msg-001')
    })

    it('should link tapbacks to part GUIDs', () => {
      const mediaMsg = createMessage({
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

      const tapbackMsg = createMessage({
        guid: 'DB:msg-003',
        messageKind: 'tapback',
        tapback: {
          type: 'loved',
          action: 'added',
          targetMessageGuid: 'p:1/DB:msg-001', // Points to media part
        },
        date: '2025-10-17T10:00:06.000Z',
      })

      const result = linkTapbacksToParents([mediaMsg, tapbackMsg])

      expect(result[1].tapback?.targetMessageGuid).toBe('p:1/DB:msg-001')
    })

    it('should apply heuristics when DB association missing', () => {
      const parentMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Funny message',
        date: '2025-10-17T10:00:00.000Z',
      })

      const tapbackMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'tapback',
        tapback: {
          type: 'laughed',
          action: 'added',
          emoji: 'haha',
        },
        date: '2025-10-17T10:00:10.000Z',
      })

      const result = linkTapbacksToParents([parentMsg, tapbackMsg])

      // Should link based on timestamp proximity
      expect(result[1].tapback?.targetMessageGuid).toBe('csv:123:0')
    })

    it('should prefer media messages for tapbacks without text context', () => {
      const textMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:00.000Z',
      })

      const mediaMsg = createMessage({
        guid: 'csv:123:1',
        messageKind: 'media',
        media: {
          id: 'media:1',
          filename: 'funny.gif',
          path: '/tmp/funny.gif',
        },
        date: '2025-10-17T10:00:01.000Z',
      })

      const tapbackMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'tapback',
        tapback: {
          type: 'laughed',
          action: 'added',
        },
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkTapbacksToParents([textMsg, mediaMsg, tapbackMsg])

      // Should link to media (more likely target for reaction)
      expect(result[2].tapback?.targetMessageGuid).toBe('csv:123:1')
    })
  })

  describe('AC04 — Ambiguous link handling with logging', () => {
    it('should detect ambiguous links and log tie information', () => {
      const msg1 = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Funny',
        date: '2025-10-17T10:00:00.000Z',
      })

      const msg2 = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: 'Funny',
        date: '2025-10-17T10:00:05.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Haha',
        date: '2025-10-17T10:00:10.000Z',
      })

      const { linked, ambiguousLinks } = linkRepliesToParents([msg1, msg2, replyMsg], {
        trackAmbiguous: true,
      }) as any

      expect(ambiguousLinks).toBeDefined()
      expect(ambiguousLinks.length).toBeGreaterThan(0)
      expect(ambiguousLinks[0]).toHaveProperty('messageGuid', 'csv:123:0')
      expect(ambiguousLinks[0]).toHaveProperty('candidates')
    })

    it('should include tie counter in ambiguous links report', () => {
      const msg1 = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:00.000Z',
      })

      const msg2 = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:05.000Z',
      })

      const msg3 = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Hi',
        date: '2025-10-17T10:00:10.000Z',
      })

      const replyMsg = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: 'Reply',
        date: '2025-10-17T10:00:15.000Z',
      })

      const result = detectAmbiguousLinks([msg1, msg2, msg3, replyMsg])

      expect(result.tieCount).toBeGreaterThan(0)
      expect(result.ambiguousMessages).toContainEqual(
        expect.objectContaining({
          messageGuid: 'csv:124:0',
        }),
      )
    })

    it('should log confidence scores for top candidates', () => {
      const parent1 = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'First option',
        date: '2025-10-17T10:00:00.000Z',
      })

      const parent2 = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: 'Second option',
        date: '2025-10-17T10:00:05.000Z',
      })

      const reply = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Definitely the second one',
        date: '2025-10-17T10:00:10.000Z',
      })

      const ambiguous = detectAmbiguousLinks([parent1, parent2, reply])

      // Should track scoring details
      expect(ambiguous.ambiguousMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            topCandidates: expect.any(Array),
          }),
        ]),
      )
    })
  })

  describe('AC05 — CSV linking parity', () => {
    it('should match CSV analyzer scoring for text replies', () => {
      // Replicating CSV analyzer test case
      const parent = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'The quick brown fox jumps',
        date: '2025-10-17T10:00:00.000Z',
      })

      const reply = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: '➜ Replying to: "The quick brown fox jumps"\nI agree',
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkRepliesToParents([parent, reply])

      expect(result[1].replyingTo?.targetMessageGuid).toBe('csv:123:0')
    })

    it('should match CSV analyzer scoring for partial text matches', () => {
      const parent = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'The quick brown fox jumps over the lazy dog',
        date: '2025-10-17T10:00:00.000Z',
      })

      const reply = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: '➜ Replying to: "quick brown fox"\nnice one',
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkRepliesToParents([parent, reply])

      expect(result[1].replyingTo?.targetMessageGuid).toBe('csv:123:0')
    })

    it('should match CSV analyzer scoring for media-implied replies', () => {
      const textPart = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Here is a photo',
        date: '2025-10-17T10:00:00.000Z',
      })

      const mediaPart = createMessage({
        guid: 'csv:123:1',
        messageKind: 'media',
        media: {
          id: 'media:1',
          filename: 'IMG_001.jpg',
          path: '/tmp/IMG_001.jpg',
        },
        date: '2025-10-17T10:00:01.000Z',
      })

      const reply = createMessage({
        guid: 'csv:124:0',
        messageKind: 'text',
        text: 'looks great!',
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkRepliesToParents([textPart, mediaPart, reply])

      // CSV analyzer prefers media for image-related replies
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:123:1')
    })

    it('should apply same timestamp buckets as CSV analyzer', () => {
      const parent1 = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Old message',
        date: '2025-10-17T09:56:00.000Z', // 9 minutes before reply (outside 5min window)
      })

      const parent2 = createMessage({
        guid: 'csv:122:0',
        messageKind: 'media',
        media: {
          id: 'media:1',
          filename: 'photo.jpg',
          path: '/tmp/photo.jpg',
        },
        date: '2025-10-17T10:00:00.000Z', // 5 minutes before reply
      })

      const reply = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Great photo!',
        date: '2025-10-17T10:05:00.000Z',
      })

      const result = linkRepliesToParents([parent1, parent2, reply])

      // Should link to media parent (within window + content match for media)
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:122:0')
    })
  })

  describe('edge cases', () => {
    it('should not link empty replies', () => {
      const parent = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const emptyReply = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: '',
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkRepliesToParents([parent, emptyReply])

      expect(result[1].replyingTo?.targetMessageGuid).toBeUndefined()
    })

    it('should not link to tapback or notification messages', () => {
      const parent = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Hello',
        date: '2025-10-17T10:00:00.000Z',
      })

      const tapback = createMessage({
        guid: 'csv:122:0',
        messageKind: 'tapback',
        tapback: { type: 'loved', action: 'added' },
        date: '2025-10-17T10:00:05.000Z',
      })

      const reply = createMessage({
        guid: 'csv:123:0',
        messageKind: 'text',
        text: 'Reply',
        date: '2025-10-17T10:00:10.000Z',
      })

      const result = linkRepliesToParents([parent, tapback, reply])

      // Should link to parent, skip tapback
      expect(result[2].replyingTo?.targetMessageGuid).toBe('csv:121:0')
    })

    it('should handle self-replies gracefully', () => {
      const parent = createMessage({
        guid: 'csv:121:0',
        messageKind: 'text',
        text: 'Initial message',
        handle: '+61412345678',
        date: '2025-10-17T10:00:00.000Z',
      })

      const selfReply = createMessage({
        guid: 'csv:122:0',
        messageKind: 'text',
        text: 'My follow-up',
        handle: '+61412345678', // Same sender
        date: '2025-10-17T10:00:05.000Z',
      })

      const result = linkRepliesToParents([parent, selfReply])

      // May or may not link; should not crash
      expect(result).toHaveLength(2)
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
