#!/usr/bin/env node
/**
 * Quick verification script for the message schema
 * Ensures all schemas instantiate without errors
 */

import {
  MessageSchema,
  ExportEnvelopeSchema,
  MediaMetaSchema,
  MediaEnrichmentSchema,
  TapbackInfoSchema,
  ReplyInfoSchema,
  MessageCoreSchema,
} from '../src/schema/message.ts'

console.log('✅ All schemas loaded successfully!')
console.log('Available schemas:')
console.log('  - MessageCoreSchema')
console.log('  - MessageSchema')
console.log('  - MediaMetaSchema')
console.log('  - MediaEnrichmentSchema')
console.log('  - TapbackInfoSchema')
console.log('  - ReplyInfoSchema')
console.log('  - ExportEnvelopeSchema')

// Test basic parsing of a minimal valid message
const testTextMessage = {
  guid: 'test-guid-123',
  isFromMe: true,
  date: '2025-10-17T10:00:00.000Z',
  messageKind: 'text',
  text: 'Hello world'
}

try {
  const parsed = MessageSchema.parse(testTextMessage)
  console.log('\n✅ Successfully parsed test text message')
  console.log('Parsed message:', JSON.stringify(parsed, null, 2))
} catch (error) {
  console.error('\n❌ Failed to parse test message:', error)
  process.exit(1)
}

// Test media message validation
const testMediaMessage = {
  guid: 'test-media-guid-456',
  isFromMe: false,
  date: '2025-10-17T10:05:00.000Z',
  messageKind: 'media',
  media: {
    id: 'media-id-123',
    filename: 'test.jpg',
    path: '/absolute/path/to/test.jpg',
    mediaKind: 'image',
  }
}

try {
  const parsed = MessageSchema.parse(testMediaMessage)
  console.log('\n✅ Successfully parsed test media message')
} catch (error) {
  console.error('\n❌ Failed to parse media message:', error)
  process.exit(1)
}

// Test invalid message (media kind without media payload) - should fail
const invalidMessage = {
  guid: 'invalid-guid-789',
  isFromMe: true,
  date: '2025-10-17T10:10:00.000Z',
  messageKind: 'media',
  text: 'This should fail'
}

try {
  MessageSchema.parse(invalidMessage)
  console.error('\n❌ Should have failed validation for media message without media payload!')
  process.exit(1)
} catch (error) {
  console.log('\n✅ Correctly rejected invalid media message (no media payload)')
}

// Test date validation - should fail without Z suffix
const invalidDateMessage = {
  guid: 'invalid-date-guid',
  isFromMe: true,
  date: '2025-10-17T10:15:00',
  messageKind: 'text',
}

try {
  MessageSchema.parse(invalidDateMessage)
  console.error('\n❌ Should have failed validation for date without Z suffix!')
  process.exit(1)
} catch (error) {
  console.log('\n✅ Correctly rejected date without Z suffix or offset')
}

console.log('\n🎉 Schema verification complete! All tests passed.')
