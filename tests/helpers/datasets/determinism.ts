import { messageBuilder } from '../test-data-builders'

import type { Message } from '../../../src/schema/message'

// Simple zero-pad helper (avoid relying on String.prototype.padStart typing)
function zeroPad(num: number, width: number): string {
  let s = String(num)
  while (s.length < width) {
    s = '0' + s
  }
  return s
}

/**
 * Deterministic test message factory
 * Ensures stable defaults and explicit control over fields
 */
export function createTestMessage(overrides: Partial<Message> = {}): Message {
  const guid = overrides.guid || 'guid-fixed'
  const date = overrides.date || '2025-01-15T10:00:00Z'
  const handle = overrides.handle || 'Test User'

  return messageBuilder()
    .guid(guid)
    .text(overrides.text ?? 'Test message')
    .from(handle)
    .fromThem()
    .date(typeof date === 'string' ? date : new Date(date).toISOString())
    .build()
}

/** Create a small dataset (10 messages) */
export function createSmallDataset(): Array<Message> {
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

/** Create a medium dataset (100 messages) */
export function createMediumDataset(): Array<Message> {
  const messages: Array<Message> = []
  for (let i = 0; i < 100; i++) {
    const hour = Math.floor(i / 10)
    const hourStr = zeroPad(Math.min(hour, 23), 2)
    const minuteVal = (i * 6) % 60
    const minuteStr = zeroPad(minuteVal, 2)
    const date = `2025-01-15T${hourStr}:${minuteStr}:00Z`
    const idx = i + 1
    const guidNum = zeroPad(idx, 3)
    messages.push(
      createTestMessage({
        guid: `msg-${guidNum}`,
        date,
        text: `Message ${idx}`,
      }),
    )
  }
  return messages
}

/** Create a large dataset (500 messages) */
export function createLargeDataset(): Array<Message> {
  const messages: Array<Message> = []
  for (let i = 0; i < 500; i++) {
    const dayOffset = Math.floor(i / 100)
    const dateObj = new Date('2025-01-15T00:00:00Z')
    dateObj.setDate(dateObj.getDate() + dayOffset)
    dateObj.setHours(Math.floor((i % 100) / 4))
    dateObj.setMinutes((i * 7) % 60)
    const idx = i + 1
    const guidNum = zeroPad(idx, 4)
    messages.push(
      createTestMessage({
        guid: `msg-${guidNum}`,
        date: dateObj.toISOString(),
        text: `Message ${idx}`,
      }),
    )
  }
  return messages
}

/** Create a huge dataset (1000 messages) */
export function createHugeDataset(): Array<Message> {
  const messages: Array<Message> = []
  for (let i = 0; i < 1000; i++) {
    const dayOffset = Math.floor(i / 144)
    const dateObj = new Date('2025-01-15T00:00:00Z')
    dateObj.setDate(dateObj.getDate() + dayOffset)
    dateObj.setHours(Math.floor((i % 144) / 6))
    dateObj.setMinutes((i * 11) % 60)
    const idx = i + 1
    const guidNum = zeroPad(idx, 4)
    messages.push(
      createTestMessage({
        guid: `msg-${guidNum}`,
        date: dateObj.toISOString(),
        text: `Message ${idx}`,
      }),
    )
  }
  return messages
}
