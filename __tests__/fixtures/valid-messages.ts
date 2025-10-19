// __tests__/fixtures/valid-messages.ts
// Happy path fixtures - all should pass validation

import type { Message } from '../../src/schema/message'

export const validTextMessage: Message = {
  guid: 'DB:text-001',
  messageKind: 'text',
  text: 'Hello world',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  handle: '+1234567890',
}

export const validTextMessageMinimal: Message = {
  guid: 'DB:text-002',
  messageKind: 'text',
  text: 'Minimal text message',
  isFromMe: false,
  date: '2023-10-23T06:55:00.000Z',
}

export const validTextMessageWithAllDates: Message = {
  guid: 'DB:text-003',
  messageKind: 'text',
  text: 'Message with all date fields',
  isFromMe: true,
  date: '2023-10-23T06:52:57.000Z',
  dateRead: '2023-10-23T06:53:00.000Z',
  dateDelivered: '2023-10-23T06:52:58.000Z',
  dateEdited: '2023-10-23T06:54:00.000Z',
  handle: '+1234567890',
}

export const validMediaMessage: Message = {
  guid: 'DB:media-001',
  messageKind: 'media',
  isFromMe: false,
  date: '2023-10-23T07:00:00.000Z',
  media: {
    id: 'media:abc123',
    filename: 'photo.jpg',
    path: '/Users/me/Pictures/photo.jpg',
    mimeType: 'image/jpeg',
    mediaKind: 'image',
    size: 5000,
  },
}

export const validMediaMessageWithEnrichment: Message = {
  guid: 'DB:media-002',
  messageKind: 'media',
  isFromMe: true,
  date: '2023-10-23T07:05:00.000Z',
  media: {
    id: 'media:xyz789',
    filename: 'video.mp4',
    path: '/Users/me/Videos/video.mp4',
    mimeType: 'video/mp4',
    mediaKind: 'video',
    size: 50000,
    enrichment: [
      {
        kind: 'video',
        model: 'gemini-1.5-flash',
        createdAt: '2023-10-23T07:06:00.000Z',
        visionSummary: 'A video of a cat playing',
        shortDescription: 'Cat video',
        provider: 'gemini',
        version: '1.0.0',
      },
    ],
  },
}

export const validMediaMessageAudio: Message = {
  guid: 'DB:media-003',
  messageKind: 'media',
  isFromMe: false,
  date: '2023-10-23T07:10:00.000Z',
  media: {
    id: 'media:audio123',
    filename: 'voice_memo.m4a',
    path: '/Users/me/Audio/voice_memo.m4a',
    mimeType: 'audio/m4a',
    mediaKind: 'audio',
    size: 12000,
    enrichment: [
      {
        kind: 'audio',
        model: 'whisper-1',
        createdAt: '2023-10-23T07:11:00.000Z',
        transcript: 'This is a test audio message',
        provider: 'local',
        version: '1.0.0',
      },
    ],
  },
}

export const validTapbackMessage: Message = {
  guid: 'DB:tapback-001',
  messageKind: 'tapback',
  isFromMe: true,
  date: '2023-10-23T07:15:00.000Z',
  tapback: {
    type: 'loved',
    action: 'added',
    targetMessageGuid: 'DB:text-001',
  },
}

export const validTapbackMessageWithAllFields: Message = {
  guid: 'DB:tapback-002',
  messageKind: 'tapback',
  isFromMe: false,
  date: '2023-10-23T07:20:00.000Z',
  tapback: {
    type: 'liked',
    action: 'removed',
    targetMessageGuid: 'DB:media-001',
    targetMessagePart: 0,
    targetText: 'Some text',
    isMedia: true,
  },
}

export const validTapbackEmojiMessage: Message = {
  guid: 'DB:tapback-003',
  messageKind: 'tapback',
  isFromMe: true,
  date: '2023-10-23T07:25:00.000Z',
  tapback: {
    type: 'emoji',
    action: 'added',
    targetMessageGuid: 'DB:text-002',
    emoji: '👍',
  },
}

export const validNotificationMessage: Message = {
  guid: 'DB:notification-001',
  messageKind: 'notification',
  isFromMe: false,
  date: '2023-10-23T07:30:00.000Z',
}

export const validNotificationWithGroupInfo: Message = {
  guid: 'DB:notification-002',
  messageKind: 'notification',
  isFromMe: false,
  date: '2023-10-23T07:35:00.000Z',
  groupTitle: 'Family Group',
  groupActionType: 1,
}

export const validTextMessageWithReply: Message = {
  guid: 'DB:text-004',
  messageKind: 'text',
  text: 'This is a reply',
  isFromMe: true,
  date: '2023-10-23T07:40:00.000Z',
  replyingTo: {
    sender: '+9876543210',
    date: '2023-10-23T07:39:00.000Z',
    text: 'Original message',
    targetMessageGuid: 'DB:text-001',
  },
}

// All valid messages in an array for easy iteration
export const allValidMessages: Message[] = [
  validTextMessage,
  validTextMessageMinimal,
  validTextMessageWithAllDates,
  validMediaMessage,
  validMediaMessageWithEnrichment,
  validMediaMessageAudio,
  validTapbackMessage,
  validTapbackMessageWithAllFields,
  validTapbackEmojiMessage,
  validNotificationMessage,
  validNotificationWithGroupInfo,
  validTextMessageWithReply,
]
