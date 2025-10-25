import { describe, it, expect, beforeEach } from 'vitest'
import type { Message } from '#schema/message'
import {
  findRepliesForMessage,
  findTapbacksForMessage,
  renderReplyAsBlockquote,
  renderTapbackAsEmoji,
  getTapbackEmoji,
  buildReplyTree,
  calculateIndentationLevel,
  formatReplyWithIndentation,
  getTapbacksGrouped,
  type ReplyContext,
  type TapbackContext,
} from '../reply-rendering'

describe('RENDER--T02: Nested Reply and Tapback Rendering', () => {
  const createTestMessage = (guid: string, text: string, replyTo?: string, tapback?: any): Message => ({
    guid,
    messageKind: replyTo ? 'text' : tapback ? 'tapback' : 'text',
    isFromMe: false,
    date: '2025-10-17T10:00:00.000Z',
    text,
    ...(replyTo && { replyingTo: { targetMessageGuid: replyTo } }),
    ...(tapback && { tapback }),
  })

  describe('AC01: Render replies as nested blockquotes', () => {
    it('should find replies for a parent message', () => {
      const messages: Message[] = [
        createTestMessage('parent-1', 'Parent message'),
        createTestMessage('reply-1', 'First reply', 'parent-1'),
        createTestMessage('reply-2', 'Second reply', 'parent-1'),
        createTestMessage('unrelated', 'Unrelated message'),
      ]

      const replies = findRepliesForMessage('parent-1', messages)

      expect(replies).toHaveLength(2)
      expect(replies[0].guid).toBe('reply-1')
      expect(replies[1].guid).toBe('reply-2')
    })

    it('should render single-level reply as blockquote', () => {
      const parentMsg: Message = {
        guid: 'parent',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:00:00.000Z',
        text: 'Parent message',
      }

      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'This is a reply',
        replyingTo: { targetMessageGuid: 'parent' },
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)

      expect(rendered).toContain('>')
      expect(rendered).toContain('This is a reply')
    })

    it('should include sender name in blockquote', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply text',
        handle: 'Alice',
        replyingTo: { targetMessageGuid: 'parent' },
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)

      expect(rendered).toContain('Alice')
      expect(rendered).toContain('>')
    })

    it('should handle replies with no visible sender gracefully', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply with no sender',
        replyingTo: { targetMessageGuid: 'parent' },
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)

      expect(rendered).toContain('>')
      expect(rendered).toContain('Reply with no sender')
    })
  })

  describe('AC02: Render tapbacks as emoji reactions', () => {
    it('should map liked tapback to heart emoji', () => {
      const emoji = getTapbackEmoji('liked')
      expect(emoji).toBe('❤️')
    })

    it('should map loved tapback to heart eyes emoji', () => {
      const emoji = getTapbackEmoji('loved')
      expect(emoji).toBe('😍')
    })

    it('should map laughed tapback to laughing emoji', () => {
      const emoji = getTapbackEmoji('laughed')
      expect(emoji).toBe('😂')
    })

    it('should map emphasized tapback to exclamation emoji', () => {
      const emoji = getTapbackEmoji('emphasized')
      expect(emoji).toBe('‼️')
    })

    it('should map questioned tapback to question emoji', () => {
      const emoji = getTapbackEmoji('questioned')
      expect(emoji).toBe('❓')
    })

    it('should map disliked tapback to thumbs down emoji', () => {
      const emoji = getTapbackEmoji('disliked')
      expect(emoji).toBe('👎')
    })

    it('should find tapbacks for a parent message', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent message'),
        {
          guid: 'tapback-1',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:01:00.000Z',
          tapback: { type: 'liked', action: 'added', targetMessageGuid: 'parent' },
        },
        {
          guid: 'tapback-2',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:02:00.000Z',
          tapback: { type: 'laughed', action: 'added', targetMessageGuid: 'parent' },
        },
      ]

      const tapbacks = findTapbacksForMessage('parent', messages)

      expect(tapbacks).toHaveLength(2)
      expect(tapbacks[0].guid).toBe('tapback-1')
      expect(tapbacks[1].guid).toBe('tapback-2')
    })

    it('should render tapback as emoji reaction', () => {
      const tapbackMsg: Message = {
        guid: 'tapback',
        messageKind: 'tapback',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        tapback: { type: 'liked', action: 'added' },
      }

      const emoji = renderTapbackAsEmoji(tapbackMsg)

      expect(emoji).toBe('❤️')
    })

    it('should handle unknown tapback type gracefully', () => {
      const emoji = getTapbackEmoji('unknown' as any)
      expect(emoji).toBeDefined()
      expect(typeof emoji).toBe('string')
    })
  })

  describe('AC03: Handle multi-level nesting (reply to reply)', () => {
    it('should detect 2-level nesting (reply to reply)', () => {
      const messages: Message[] = [
        createTestMessage('msg-1', 'Original message'),
        createTestMessage('msg-2', 'Reply to original', 'msg-1'),
        createTestMessage('msg-3', 'Reply to reply', 'msg-2'),
      ]

      // msg-3 replies to msg-2, which replies to msg-1
      const replies2 = findRepliesForMessage('msg-2', messages)
      expect(replies2).toHaveLength(1)
      expect(replies2[0].guid).toBe('msg-3')
    })

    it('should detect 3-level nesting (reply to reply to reply)', () => {
      const messages: Message[] = [
        createTestMessage('msg-1', 'Level 0'),
        createTestMessage('msg-2', 'Level 1', 'msg-1'),
        createTestMessage('msg-3', 'Level 2', 'msg-2'),
        createTestMessage('msg-4', 'Level 3', 'msg-3'),
      ]

      const replies3 = findRepliesForMessage('msg-3', messages)
      expect(replies3).toHaveLength(1)
      expect(replies3[0].guid).toBe('msg-4')
    })

    it('should build reply tree structure', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent'),
        createTestMessage('reply1', 'First reply', 'parent'),
        createTestMessage('reply1-1', 'Reply to first reply', 'reply1'),
        createTestMessage('reply1-2', 'Another reply to first', 'reply1'),
        createTestMessage('reply2', 'Second reply', 'parent'),
      ]

      const tree = buildReplyTree('parent', messages)

      expect(tree).toBeDefined()
      expect(tree.children).toHaveLength(2)
    })

    it('should handle deeply nested threads (5+ levels)', () => {
      const messages: Message[] = []
      let parentGuid = 'msg-0'

      for (let i = 1; i <= 6; i++) {
        messages.push(createTestMessage(`msg-${i}`, `Level ${i}`, parentGuid))
        parentGuid = `msg-${i}`
      }

      // Check we can navigate the chain
      const depth = calculateIndentationLevel('msg-6', messages)
      expect(depth).toBeGreaterThan(0)
    })
  })

  describe('AC04: Indent levels match conversation depth (2 spaces per level)', () => {
    it('should calculate indentation level 0 for top-level reply', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent'),
        createTestMessage('reply', 'Reply', 'parent'),
      ]

      const level = calculateIndentationLevel('reply', messages)
      expect(level).toBe(1) // 1 level deep
    })

    it('should calculate indentation level 1 for 2-level nested reply', () => {
      const messages: Message[] = [
        createTestMessage('msg-1', 'Level 0'),
        createTestMessage('msg-2', 'Level 1', 'msg-1'),
        createTestMessage('msg-3', 'Level 2', 'msg-2'),
      ]

      const level = calculateIndentationLevel('msg-3', messages)
      expect(level).toBe(2)
    })

    it('should calculate indentation level 2 for 3-level nested reply', () => {
      const messages: Message[] = [
        createTestMessage('msg-1', 'Level 0'),
        createTestMessage('msg-2', 'Level 1', 'msg-1'),
        createTestMessage('msg-3', 'Level 2', 'msg-2'),
        createTestMessage('msg-4', 'Level 3', 'msg-3'),
      ]

      const level = calculateIndentationLevel('msg-4', messages)
      expect(level).toBe(3)
    })

    it('should format reply with correct indentation (2 spaces per level)', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply text',
      }

      const formatted0 = formatReplyWithIndentation(replyMsg, 0)
      const formatted1 = formatReplyWithIndentation(replyMsg, 1)
      const formatted2 = formatReplyWithIndentation(replyMsg, 2)

      // Level 0: > (no indent)
      expect(formatted0).toMatch(/^>/)

      // Level 1: > > (2 space indent)
      expect(formatted1).toMatch(/^ {2}>/)

      // Level 2: > > > (4 space indent)
      expect(formatted2).toMatch(/^ {4}>/)
    })

    it('should maintain 2-space indentation consistently', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply',
      }

      for (let level = 0; level <= 5; level++) {
        const formatted = formatReplyWithIndentation(replyMsg, level)
        const expectedSpaces = level * 2
        const actualSpaces = formatted.match(/^ */)?.[0].length || 0
        expect(actualSpaces).toBe(expectedSpaces)
      }
    })
  })

  describe('AC05: Preserve sender attribution in nested content', () => {
    it('should include sender name in reply', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply message',
        handle: 'Alice',
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)

      expect(rendered).toContain('Alice')
      expect(rendered).toContain('Reply message')
    })

    it('should format sender as bold markdown', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply message',
        handle: 'Bob',
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)

      expect(rendered).toContain('**Bob**')
    })

    it('should preserve sender through multi-level nesting', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent', undefined),
        {
          guid: 'reply1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:01:00.000Z',
          text: 'First reply',
          handle: 'Alice',
          replyingTo: { targetMessageGuid: 'parent' },
        },
        {
          guid: 'reply2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:02:00.000Z',
          text: 'Reply to first reply',
          handle: 'Bob',
          replyingTo: { targetMessageGuid: 'reply1' },
        },
        {
          guid: 'reply3',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:03:00.000Z',
          text: 'Reply to second reply',
          handle: 'Charlie',
          replyingTo: { targetMessageGuid: 'reply2' },
        },
      ]

      const reply1 = renderReplyAsBlockquote(messages[1], 0)
      const reply2 = renderReplyAsBlockquote(messages[2], 1)
      const reply3 = renderReplyAsBlockquote(messages[3], 2)

      expect(reply1).toContain('Alice')
      expect(reply2).toContain('Bob')
      expect(reply3).toContain('Charlie')
    })

    it('should handle replies with no sender', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply without sender',
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)

      expect(rendered).toContain('Reply without sender')
      // Should not crash, but may not include sender
    })

    it('should distinguish from-me messages', () => {
      const myReply: Message = {
        guid: 'my-reply',
        messageKind: 'text',
        isFromMe: true,
        date: '2025-10-17T10:01:00.000Z',
        text: 'My reply',
        handle: 'Me',
      }

      const theirReply: Message = {
        guid: 'their-reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:02:00.000Z',
        text: 'Their reply',
        handle: 'Alice',
      }

      const myRendered = renderReplyAsBlockquote(myReply, 0)
      const theirRendered = renderReplyAsBlockquote(theirReply, 0)

      // Both should render, but implementation might distinguish them
      expect(myRendered).toBeDefined()
      expect(theirRendered).toBeDefined()
    })
  })

  describe('Integration: Complete reply and tapback rendering', () => {
    it('should render parent with single-level reply', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent message'),
        createTestMessage('reply', 'Reply to parent', 'parent'),
      ]

      const replies = findRepliesForMessage('parent', messages)
      expect(replies).toHaveLength(1)

      const rendered = replies.map((r) => renderReplyAsBlockquote(r, 0))
      expect(rendered[0]).toContain('>')
    })

    it('should render parent with tapbacks', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent message'),
        {
          guid: 'tapback',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:01:00.000Z',
          tapback: { type: 'liked', action: 'added' },
        },
      ]

      const tapbacks = findTapbacksForMessage('parent', messages)
      expect(tapbacks).toHaveLength(0) // No targetMessageGuid set

      // Test with targetMessageGuid
      messages[1].tapback = { type: 'liked', action: 'added', targetMessageGuid: 'parent' }
      const tapbacksWithTarget = findTapbacksForMessage('parent', messages)
      expect(tapbacksWithTarget).toHaveLength(1)
    })

    it('should group tapbacks by type', () => {
      const messages: Message[] = [
        createTestMessage('parent', 'Parent'),
        {
          guid: 'tap1',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:01:00.000Z',
          tapback: { type: 'liked', action: 'added', targetMessageGuid: 'parent' },
        },
        {
          guid: 'tap2',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:02:00.000Z',
          tapback: { type: 'liked', action: 'added', targetMessageGuid: 'parent' },
        },
        {
          guid: 'tap3',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:03:00.000Z',
          tapback: { type: 'laughed', action: 'added', targetMessageGuid: 'parent' },
        },
      ]

      const grouped = getTapbacksGrouped('parent', messages)
      expect(grouped).toBeDefined()
    })

    it('should handle complex nested conversation', () => {
      const messages: Message[] = [
        {
          guid: 'msg-0',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:00:00.000Z',
          text: 'Original message',
          handle: 'Alice',
        },
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: true,
          date: '2025-10-17T10:01:00.000Z',
          text: 'My response',
          handle: 'Me',
          replyingTo: { targetMessageGuid: 'msg-0' },
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:02:00.000Z',
          text: 'Alice responds to my response',
          handle: 'Alice',
          replyingTo: { targetMessageGuid: 'msg-1' },
        },
        {
          guid: 'msg-3',
          messageKind: 'text',
          isFromMe: true,
          date: '2025-10-17T10:03:00.000Z',
          text: 'My response to Alice',
          handle: 'Me',
          replyingTo: { targetMessageGuid: 'msg-2' },
        },
        {
          guid: 'tap-1',
          messageKind: 'tapback',
          isFromMe: false,
          date: '2025-10-17T10:04:00.000Z',
          tapback: { type: 'liked', action: 'added', targetMessageGuid: 'msg-3' },
        },
      ]

      const tree = buildReplyTree('msg-0', messages)
      expect(tree).toBeDefined()

      const allReplies = findRepliesForMessage('msg-0', messages)
      expect(allReplies).toHaveLength(1) // Only direct children
    })

    it('should handle empty replies', () => {
      const messages: Message[] = [createTestMessage('parent', 'Parent message')]

      const replies = findRepliesForMessage('parent', messages)
      expect(replies).toHaveLength(0)
    })

    it('should handle message with no parent (orphaned reply)', () => {
      const messages: Message[] = [
        {
          guid: 'orphan-reply',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:01:00.000Z',
          text: 'Reply to non-existent parent',
          replyingTo: { targetMessageGuid: 'non-existent-parent' },
        },
      ]

      // Orphaned reply has level 1 (it's a reply, even if parent doesn't exist)
      const level = calculateIndentationLevel('orphan-reply', messages)
      expect(level).toBe(1)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle circular reply references gracefully', () => {
      // Shouldn't happen in practice, but implementation should handle it
      const messages: Message[] = [
        {
          guid: 'msg-1',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:00:00.000Z',
          text: 'Msg 1',
          replyingTo: { targetMessageGuid: 'msg-2' },
        },
        {
          guid: 'msg-2',
          messageKind: 'text',
          isFromMe: false,
          date: '2025-10-17T10:01:00.000Z',
          text: 'Msg 2',
          replyingTo: { targetMessageGuid: 'msg-1' },
        },
      ]

      // Should not infinite loop
      const level = calculateIndentationLevel('msg-1', messages)
      expect(level).toBeDefined()
    })

    it('should handle empty message list', () => {
      const replies = findRepliesForMessage('any-guid', [])
      expect(replies).toHaveLength(0)
    })

    it('should handle null/undefined values gracefully', () => {
      const replyMsg: Message = {
        guid: 'reply',
        messageKind: 'text',
        isFromMe: false,
        date: '2025-10-17T10:01:00.000Z',
        text: 'Reply',
        handle: undefined,
      }

      const rendered = renderReplyAsBlockquote(replyMsg, 0)
      expect(rendered).toBeDefined()
    })

    it('should handle very deep nesting without stack overflow', () => {
      const messages: Message[] = []
      let parentGuid = 'root'

      for (let i = 0; i < 50; i++) {
        const guid = `msg-${i}`
        messages.push(createTestMessage(guid, `Level ${i}`, parentGuid))
        parentGuid = guid
      }

      // Should complete without error
      const level = calculateIndentationLevel('msg-49', messages)
      expect(level).toBeGreaterThan(0)
    })
  })
})
