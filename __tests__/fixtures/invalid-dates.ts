// __tests__/fixtures/invalid-dates.ts
// Date format violation fixtures - should fail validation

import type { Message } from '../../src/schema/message'

// Missing Z suffix (not UTC)
export const invalidDateMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-001',
  messageKind: 'text',
  text: 'Invalid date without Z',
  isFromMe: true,
  date: '2023-10-23T06:52:57', // Invalid: missing Z suffix
}

// Non-UTC offset
export const invalidDateWithOffset: Partial<Message> = {
  guid: 'DB:invalid-date-002',
  messageKind: 'text',
  text: 'Invalid date with offset',
  isFromMe: true,
  date: '2023-10-23T06:52:57+10:00', // Invalid: has timezone offset
}

export const invalidDateWithNegativeOffset: Partial<Message> = {
  guid: 'DB:invalid-date-003',
  messageKind: 'text',
  text: 'Invalid date with negative offset',
  isFromMe: true,
  date: '2023-10-23T06:52:57-05:00', // Invalid: has timezone offset
}

// Space instead of T separator
export const invalidDateWithSpace: Partial<Message> = {
  guid: 'DB:invalid-date-004',
  messageKind: 'text',
  text: 'Invalid date with space',
  isFromMe: true,
  date: '2023-10-23 06:52:57Z', // Invalid: space instead of T
}

// Missing time component
export const invalidDateOnly: Partial<Message> = {
  guid: 'DB:invalid-date-005',
  messageKind: 'text',
  text: 'Invalid date without time',
  isFromMe: true,
  date: '2023-10-23', // Invalid: date only, no time
}

// Invalid day of month
export const invalidDateBadDay: Partial<Message> = {
  guid: 'DB:invalid-date-006',
  messageKind: 'text',
  text: 'Invalid date - bad day',
  isFromMe: true,
  date: '2023-02-30T06:52:57.000Z', // Invalid: Feb 30 doesn't exist
}

// Invalid month
export const invalidDateBadMonth: Partial<Message> = {
  guid: 'DB:invalid-date-007',
  messageKind: 'text',
  text: 'Invalid date - bad month',
  isFromMe: true,
  date: '2023-13-01T06:52:57.000Z', // Invalid: month 13 doesn't exist
}

// Malformed date string
export const invalidDateMalformed: Partial<Message> = {
  guid: 'DB:invalid-date-008',
  messageKind: 'text',
  text: 'Malformed date',
  isFromMe: true,
  date: 'not-a-date', // Invalid: not a date at all
}

// Empty date string
export const invalidDateEmpty: Partial<Message> = {
  guid: 'DB:invalid-date-009',
  messageKind: 'text',
  text: 'Empty date',
  isFromMe: true,
  date: '', // Invalid: empty string
}

// dateRead without Z suffix
export const invalidDateReadMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-010',
  messageKind: 'text',
  text: 'Invalid dateRead',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  dateRead: '2023-10-23T06:53:00', // Invalid: missing Z suffix
}

// dateDelivered without Z suffix
export const invalidDateDeliveredMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-011',
  messageKind: 'text',
  text: 'Invalid dateDelivered',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  dateDelivered: '2023-10-23T06:52:58', // Invalid: missing Z suffix
}

// dateEdited without Z suffix
export const invalidDateEditedMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-012',
  messageKind: 'text',
  text: 'Invalid dateEdited',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  dateEdited: '2023-10-23T06:54:00', // Invalid: missing Z suffix
}

// exportTimestamp without Z suffix
export const invalidExportTimestampMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-013',
  messageKind: 'text',
  text: 'Invalid exportTimestamp',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  exportTimestamp: '2023-10-23T06:55:00', // Invalid: missing Z suffix
}

// replyingTo.date without Z suffix
export const invalidReplyDateMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-014',
  messageKind: 'text',
  text: 'Invalid replyingTo.date',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  replyingTo: {
    date: '2023-10-23T06:50:00', // Invalid: missing Z suffix
    text: 'Original message',
  },
}

// Media enrichment createdAt without Z suffix
export const invalidEnrichmentDateMissingZ: Partial<Message> = {
  guid: 'DB:invalid-date-015',
  messageKind: 'media',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  media: {
    id: 'media:invalid-enrichment',
    filename: 'test.jpg',
    path: '/Users/me/test.jpg',
    enrichment: [
      {
        kind: 'image',
        createdAt: '2023-10-23T06:53:00', // Invalid: missing Z suffix
        provider: 'gemini',
        version: '1.0.0',
      },
    ],
  },
}
