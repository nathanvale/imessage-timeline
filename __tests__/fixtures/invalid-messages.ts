// __tests__/fixtures/invalid-messages.ts
// Invariant violation fixtures - should fail validation

import type { Message } from '../../src/schema/message'

// INVARIANT: messageKind='media' requires media payload
export const invalidMediaNoPayload: Partial<Message> = {
	guid: 'DB:invalid-001',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	// Missing required 'media' payload
}

// INVARIANT: messageKind='tapback' requires tapback payload
export const invalidTapbackNoPayload: Partial<Message> = {
	guid: 'DB:invalid-002',
	messageKind: 'tapback',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	// Missing required 'tapback' payload
}

// INVARIANT: Non-media messages should not have media payload
export const invalidTextMessageWithMedia: Partial<Message> = {
	guid: 'DB:invalid-003',
	messageKind: 'text',
	text: 'Hello',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:invalid',
		filename: 'should-not-exist.jpg',
		path: '/Users/me/invalid.jpg',
	},
}

// INVARIANT: Non-media messages should not have media payload (notification case)
export const invalidNotificationWithMedia: Partial<Message> = {
	guid: 'DB:invalid-004',
	messageKind: 'notification',
	isFromMe: false,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:invalid2',
		filename: 'also-invalid.jpg',
		path: '/Users/me/invalid2.jpg',
	},
}

// INVARIANT: Non-media messages should not have media payload (tapback case)
export const invalidTapbackWithMedia: Partial<Message> = {
	guid: 'DB:invalid-005',
	messageKind: 'tapback',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	tapback: {
		type: 'loved',
		action: 'added',
	},
	media: {
		id: 'media:invalid3',
		filename: 'tapback-should-not-have-media.jpg',
		path: '/Users/me/invalid3.jpg',
	},
}

// INVARIANT: Media message with incomplete media payload (missing required fields)
export const invalidMediaIncompletePayload1: Partial<Message> = {
	guid: 'DB:invalid-006',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:incomplete1',
		// Missing required 'filename'
		path: '/Users/me/incomplete.jpg',
	} as any,
}

export const invalidMediaIncompletePayload2: Partial<Message> = {
	guid: 'DB:invalid-007',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:incomplete2',
		filename: 'incomplete.jpg',
		// Missing required 'path'
	} as any,
}

export const invalidMediaIncompletePayload3: Partial<Message> = {
	guid: 'DB:invalid-008',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		// Missing required 'id'
		filename: 'incomplete.jpg',
		path: '/Users/me/incomplete.jpg',
	} as any,
}

// INVARIANT: Media path must be absolute (not relative)
export const invalidMediaRelativePath: Partial<Message> = {
	guid: 'DB:invalid-009',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:relative',
		filename: 'relative.jpg',
		path: 'relative/path/to/file.jpg', // Invalid: relative path
	},
}

export const invalidMediaRelativePath2: Partial<Message> = {
	guid: 'DB:invalid-010',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:relative2',
		filename: 'relative2.jpg',
		path: './relative/path.jpg', // Invalid: relative path
	},
}

export const invalidMediaRelativePath3: Partial<Message> = {
	guid: 'DB:invalid-011',
	messageKind: 'media',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	media: {
		id: 'media:relative3',
		filename: 'relative3.jpg',
		path: '../relative/path.jpg', // Invalid: relative path
	},
}

// Missing required core fields
export const invalidMissingGuid: Partial<Message> = {
	// Missing 'guid'
	messageKind: 'text',
	text: 'Missing guid',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
}

export const invalidMissingIsFromMe: Partial<Message> = {
	guid: 'DB:invalid-012',
	messageKind: 'text',
	text: 'Missing isFromMe',
	// Missing 'isFromMe'
	date: '2023-10-23T06:52:57.000Z',
} as any

export const invalidMissingDate: Partial<Message> = {
	guid: 'DB:invalid-013',
	messageKind: 'text',
	text: 'Missing date',
	isFromMe: true,
	// Missing 'date'
} as any

export const invalidMissingMessageKind: Partial<Message> = {
	guid: 'DB:invalid-014',
	text: 'Missing messageKind',
	isFromMe: true,
	date: '2023-10-23T06:52:57.000Z',
	// Missing 'messageKind'
} as any
