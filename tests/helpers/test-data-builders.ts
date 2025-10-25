/**
 * Test Data Builders
 *
 * Fluent builder pattern for creating test messages with readable,
 * chainable API. Complements fixture loaders for inline test data creation.
 */

import type { Message, MediaMeta, TapbackPayload } from '../../src/schema/message'

// ============================================================================
// Message Builder
// ============================================================================

/**
 * Fluent builder for creating test Message objects
 *
 * @example
 * const msg = messageBuilder()
 *   .text('Hello world')
 *   .fromMe()
 *   .read()
 *   .build()
 */
export class MessageBuilder {
  private message: Partial<Message>

  constructor() {
    this.message = {
      guid: `test-${Date.now()}-${Math.random()}`,
      messageKind: 'text',
      isFromMe: false,
      date: new Date().toISOString(),
      service: 'iMessage',
      isRead: false,
      metadata: {
        source: 'test-builder',
      },
    }
  }

  /** Set GUID */
  guid(guid: string): this {
    this.message.guid = guid
    return this
  }

  /** Set message as text message */
  text(content: string): this {
    this.message.messageKind = 'text'
    this.message.text = content
    return this
  }

  /** Set message as from me */
  fromMe(): this {
    this.message.isFromMe = true
    return this
  }

  /** Set message as from other person */
  fromThem(): this {
    this.message.isFromMe = false
    return this
  }

  /** Set sender handle/name */
  from(handle: string): this {
    this.message.handle = handle
    return this
  }

  /** Set message as read */
  read(): this {
    this.message.isRead = true
    return this
  }

  /** Set message as unread */
  unread(): this {
    this.message.isRead = false
    return this
  }

  /** Set service (iMessage or SMS) */
  service(service: 'iMessage' | 'SMS'): this {
    this.message.service = service
    return this
  }

  /** Set as SMS */
  sms(): this {
    return this.service('SMS')
  }

  /** Set as iMessage */
  imessage(): this {
    return this.service('iMessage')
  }

  /** Set date */
  date(date: string | Date): this {
    this.message.date = typeof date === 'string' ? date : date.toISOString()
    return this
  }

  /** Set delivered date */
  deliveredAt(date: string | Date): this {
    this.message.dateDelivered = typeof date === 'string' ? date : date.toISOString()
    return this
  }

  /** Set read date */
  readAt(date: string | Date): this {
    this.message.dateRead = typeof date === 'string' ? date : date.toISOString()
    return this
  }

  /** Set edited date */
  editedAt(date: string | Date): this {
    this.message.dateEdited = typeof date === 'string' ? date : date.toISOString()
    return this
  }

  /** Add reply reference */
  replyTo(targetGuid: string): this {
    this.message.threadTargetGuid = targetGuid
    return this
  }

  /** Add subject */
  subject(subject: string): this {
    this.message.subject = subject
    return this
  }

  /** Set as media message */
  media(media: Partial<MediaMeta>): this {
    this.message.messageKind = 'media'
    this.message.media = {
      id: media.id || `media-${Date.now()}`,
      filename: media.filename || 'test.jpg',
      path: media.path || '/test/path/test.jpg',
      mediaKind: media.mediaKind || 'image',
      ...media,
    } as MediaMeta
    return this
  }

  /** Set as image message */
  image(filename: string = 'photo.jpg', path?: string): this {
    return this.media({
      filename,
      path: path || `/test/path/${filename}`,
      mediaKind: 'image',
    })
  }

  /** Set as audio message */
  audio(filename: string = 'audio.m4a', path?: string): this {
    return this.media({
      filename,
      path: path || `/test/path/${filename}`,
      mediaKind: 'audio',
    })
  }

  /** Set as video message */
  video(filename: string = 'video.mov', path?: string): this {
    return this.media({
      filename,
      path: path || `/test/path/${filename}`,
      mediaKind: 'video',
    })
  }

  /** Set as PDF message */
  pdf(filename: string = 'document.pdf', path?: string): this {
    return this.media({
      filename,
      path: path || `/test/path/${filename}`,
      mediaKind: 'pdf',
    })
  }

  /** Set as tapback message */
  tapback(kind: TapbackPayload['tapbackKind'], targetGuid: string): this {
    this.message.messageKind = 'tapback'
    this.message.tapback = {
      tapbackKind: kind,
      targetGuid,
    }
    return this
  }

  /** Set as notification message */
  notification(text: string): this {
    this.message.messageKind = 'notification'
    this.message.notificationText = text
    return this
  }

  /** Add metadata fields */
  metadata(metadata: Record<string, any>): this {
    this.message.metadata = {
      ...this.message.metadata,
      ...metadata,
    }
    return this
  }

  /** Build the final message */
  build(): Message {
    return this.message as Message
  }
}

/**
 * Creates a new message builder
 *
 * @example
 * const msg = messageBuilder()
 *   .text('Hello')
 *   .fromMe()
 *   .build()
 */
export function messageBuilder(): MessageBuilder {
  return new MessageBuilder()
}

// ============================================================================
// Batch Builders
// ============================================================================

/**
 * Creates a conversation thread (series of messages with replies)
 *
 * @param count - Number of messages in thread
 * @returns Array of messages with reply chains
 *
 * @example
 * const thread = conversationThread(5)
 * // Creates 5 messages where each replies to the previous
 */
export function conversationThread(count: number): Message[] {
  const messages: Message[] = []

  for (let i = 0; i < count; i++) {
    const builder = messageBuilder()
      .text(`Message ${i + 1}`)
      .from(i % 2 === 0 ? 'Alice' : 'Bob')
      .date(new Date(Date.now() + i * 60000).toISOString()) // 1 min apart

    if (i > 0) {
      builder.replyTo(messages[i - 1].guid)
    }

    messages.push(builder.build())
  }

  return messages
}

/**
 * Creates alternating sent/received messages
 *
 * @param count - Number of messages
 * @returns Array of alternating messages
 *
 * @example
 * const msgs = alternatingMessages(10)
 * // Creates 10 messages alternating between sent and received
 */
export function alternatingMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) =>
    messageBuilder()
      .text(`Message ${i + 1}`)
      .from(i % 2 === 0 ? 'Alice' : 'Me')
      [i % 2 === 0 ? 'fromThem' : 'fromMe']()
      .date(new Date(Date.now() + i * 60000).toISOString())
      .build(),
  )
}

/**
 * Creates messages with various media types
 *
 * @param count - Number of each media type
 * @returns Array of media messages
 *
 * @example
 * const media = mediaMessages(2)
 * // Creates 2 of each: image, audio, video, pdf
 */
export function mediaMessages(count: number = 1): Message[] {
  const messages: Message[] = []
  const types = [
    { method: 'image' as const, file: 'photo.jpg' },
    { method: 'audio' as const, file: 'audio.m4a' },
    { method: 'video' as const, file: 'video.mov' },
    { method: 'pdf' as const, file: 'doc.pdf' },
  ]

  for (const type of types) {
    for (let i = 0; i < count; i++) {
      const msg = messageBuilder()
        [type.method](`${type.file.split('.')[0]}-${i + 1}.${type.file.split('.')[1]}`)
        .build()
      messages.push(msg)
    }
  }

  return messages
}

/**
 * Creates tapback messages for a parent message
 *
 * @param parentGuid - GUID of parent message
 * @param kinds - Array of tapback kinds to create
 * @returns Array of tapback messages
 *
 * @example
 * const reactions = tapbackMessages('msg-123', ['liked', 'loved', 'laughed'])
 */
export function tapbackMessages(
  parentGuid: string,
  kinds: TapbackPayload['tapbackKind'][] = ['liked', 'loved', 'laughed'],
): Message[] {
  return kinds.map((kind, i) =>
    messageBuilder()
      .tapback(kind, parentGuid)
      .from(`User${i + 1}`)
      .date(new Date(Date.now() + i * 1000).toISOString())
      .build(),
  )
}

/**
 * Creates a realistic daily message pattern
 *
 * @param date - Date for the messages
 * @returns Array of messages distributed throughout the day
 *
 * @example
 * const daily = dailyMessagePattern('2025-10-19')
 * // Creates ~20 messages distributed morning, afternoon, evening
 */
export function dailyMessagePattern(date: string | Date): Message[] {
  const baseDate = typeof date === 'string' ? new Date(date) : date
  const messages: Message[] = []

  // Morning: 8am-11am (5 messages)
  for (let i = 0; i < 5; i++) {
    const time = new Date(baseDate)
    time.setHours(8 + i, Math.floor(Math.random() * 60))
    messages.push(
      messageBuilder()
        .text(`Morning message ${i + 1}`)
        [i % 2 === 0 ? 'fromMe' : 'fromThem']()
        .date(time.toISOString())
        .build(),
    )
  }

  // Afternoon: 12pm-5pm (8 messages)
  for (let i = 0; i < 8; i++) {
    const time = new Date(baseDate)
    time.setHours(12 + i, Math.floor(Math.random() * 60))
    messages.push(
      messageBuilder()
        .text(`Afternoon message ${i + 1}`)
        [i % 2 === 0 ? 'fromMe' : 'fromThem']()
        .date(time.toISOString())
        .build(),
    )
  }

  // Evening: 6pm-10pm (7 messages)
  for (let i = 0; i < 7; i++) {
    const time = new Date(baseDate)
    time.setHours(18 + i, Math.floor(Math.random() * 60))
    messages.push(
      messageBuilder()
        .text(`Evening message ${i + 1}`)
        [i % 2 === 0 ? 'fromMe' : 'fromThem']()
        .date(time.toISOString())
        .build(),
    )
  }

  return messages
}
