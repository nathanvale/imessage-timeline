# Test Helper Utilities

Centralized test utilities for the iMessage pipeline project. These helpers provide consistent, reusable patterns for testing across all modules.

## Overview

This directory contains four main categories of test helpers:

1. **Mock Providers** (`mock-providers.ts`) - Mock AI services (Gemini, Firecrawl)
2. **Fixture Loaders** (`fixture-loaders.ts`) - Load and create test data
3. **Schema Assertions** (`schema-assertions.ts`) - Validate messages with clear error messages
4. **Test Data Builders** (`test-data-builders.ts`) - Fluent API for creating test messages

## Usage

Import helpers from the index file:

```typescript
import {
  createMockProviderSuite,
  createMessageFixture,
  assertValidMessage,
  messageBuilder,
} from '../helpers'
```

Or import specific modules:

```typescript
import { createMockGeminiVision } from '../helpers/mock-providers'
import { loadMessageFixture } from '../helpers/fixture-loaders'
```

---

## Mock Providers

### Quick Start

```typescript
import { createMockProviderSuite, resetAllMocks } from '../helpers'

describe('Enrichment Tests', () => {
  const mocks = createMockProviderSuite()

  beforeEach(() => {
    resetAllMocks(mocks)
  })

  it('should analyze images', async () => {
    const result = await mocks.geminiVision('/path/to/image.jpg')
    expect(result.visionSummary).toBeDefined()
  })
})
```

### Available Mock Providers

| Function | Purpose | Example |
|----------|---------|---------|
| `createMockGeminiVision()` | Image analysis | Vision API responses |
| `createMockGeminiAudio()` | Audio transcription | Transcription results |
| `createMockGeminiPdf()` | PDF summarization | PDF summaries |
| `createMockFirecrawl()` | Link context extraction | Web page metadata |
| `createMockYouTube()` | YouTube metadata | Video titles, channels |
| `createMockSpotify()` | Spotify metadata | Track, artist info |
| `createMockTwitter()` | Twitter/X metadata | Tweet content |
| `createMockInstagram()` | Instagram metadata | Post captions |

### Composite Helpers

```typescript
// Create all mocks at once
const mocks = createMockProviderSuite()

// Setup all mocks to fail (for error testing)
setupMockFailures(mocks, 'Rate limited')

// Reset all mock call histories
resetAllMocks(mocks)
```

### Custom Mock Responses

```typescript
const mockGemini = createMockGeminiVision()

// Override default response
mockGemini.mockResolvedValueOnce({
  visionSummary: 'A beautiful sunset over the ocean',
  shortDescription: 'Sunset photo',
  provider: 'gemini',
  model: 'gemini-1.5-pro',
  version: '2025-10-17',
  createdAt: new Date().toISOString(),
})
```

---

## Fixture Loaders

### Quick Start

```typescript
import { createMessageFixture, createMessagesFixture } from '../helpers'

describe('Message Processing', () => {
  it('should handle single message', () => {
    const msg = createMessageFixture({ text: 'Test message' })
    expect(msg.guid).toBeDefined()
  })

  it('should handle multiple messages', () => {
    const messages = createMessagesFixture(10)
    expect(messages).toHaveLength(10)
  })
})
```

### Fixture Factories

#### Basic Messages

```typescript
// Single message with defaults
const msg = createMessageFixture()

// Override specific fields
const customMsg = createMessageFixture({
  text: 'Custom text',
  isFromMe: true,
  handle: 'Alice',
})

// Multiple messages with custom overrides
const messages = createMessagesFixture(5, (i) => ({
  text: `Message ${i}`,
  isFromMe: i % 2 === 0,
}))
```

#### Media Messages

```typescript
// Create image message
const imgMsg = createMediaMessageFixture('image', {
  media: {
    filename: 'photo.heic',
    path: '/abs/path/photo.heic',
  },
})

// Create audio message
const audioMsg = createMediaMessageFixture('audio')

// Create video message
const videoMsg = createMediaMessageFixture('video')

// Create PDF message
const pdfMsg = createMediaMessageFixture('pdf')
```

#### Tapback Messages

```typescript
const parentMsg = createMessageFixture()

const tapback = createTapbackFixture('liked', parentMsg.guid)
const loved = createTapbackFixture('loved', parentMsg.guid)
const laughed = createTapbackFixture('laughed', parentMsg.guid)
```

### File-Based Fixtures

```typescript
// Load JSON fixture
const data = loadFixture('messages/dataset.json')

// Load message fixture with validation
const { messages, metadata } = loadMessageFixture('small-dataset.json')

// Load CSV fixture as string
const csvContent = loadCsvFixture('melanie-messages.csv')

// Load text fixture
const markdown = loadTextFixture('expected-output.md')

// Check if fixture exists
if (fixtureExists('optional-data.json')) {
  const data = loadFixture('optional-data.json')
}
```

---

## Schema Assertions

### Quick Start

```typescript
import { assertValidMessage, assertTextMessage, getValidationStats } from '../helpers'

describe('Schema Validation', () => {
  it('should validate message', () => {
    const msg = createMessageFixture()
    assertValidMessage(msg) // Throws if invalid
  })

  it('should validate stats', () => {
    const messages = createMessagesFixture(100)
    const stats = getValidationStats(messages)
    expect(stats.validCount).toBe(100)
  })
})
```

### Validation Functions

```typescript
// Validate single message (returns result object)
const result = validateMessage(msg)
if (!result.success) {
  console.error(result.errors)
}

// Validate array (returns array of results)
const results = validateMessages(messages)
const failed = results.filter((r) => !r.success)
```

### Assertion Functions

```typescript
// Assert message is valid (throws if not)
assertValidMessage(msg)

// Assert all messages are valid
assertValidMessages(messages)

// Expect message to be invalid
expectInvalidMessage(badMsg)
expectInvalidMessage(badMsg, /ISO 8601/) // Check specific error
```

### Type-Specific Assertions

```typescript
// Assert message kind
assertTextMessage(msg) // TypeScript narrows to TextMessage
assertMediaMessage(msg) // TypeScript narrows to MediaMessage
assertTapbackMessage(msg) // TypeScript narrows to TapbackMessage
assertNotificationMessage(msg) // TypeScript narrows to NotificationMessage
```

### Field Assertions

```typescript
// Assert valid ISO 8601 date
assertValidISO8601(msg.date)
assertValidISO8601(msg.dateDelivered, 'dateDelivered')

// Assert valid GUID format
assertValidGuid(msg.guid)
assertValidGuid(msg.guid, 'csv:') // With prefix check

// Assert absolute path
assertAbsolutePath(msg.media.path)

// Assert enrichment exists
assertHasEnrichment(msg.media.enrichment, 'image_analysis')
```

### Validation Statistics

```typescript
const stats = getValidationStats(messages)

console.log(`Valid: ${stats.validCount}/${stats.totalCount}`)
console.log(`By kind:`, stats.byKind) // { text: 80, media: 20 }
console.log(`Invalid:`, stats.invalidMessages) // Array of errors

// Assert minimum success rate
assertValidationRate(messages, 0.95) // Expect 95%+ valid
```

---

## Test Data Builders

### Quick Start

```typescript
import { messageBuilder, conversationThread } from '../helpers'

describe('Message Tests', () => {
  it('should build message fluently', () => {
    const msg = messageBuilder()
      .text('Hello world')
      .fromMe()
      .read()
      .imessage()
      .build()

    expect(msg.text).toBe('Hello world')
    expect(msg.isFromMe).toBe(true)
  })

  it('should create conversation', () => {
    const thread = conversationThread(5)
    expect(thread).toHaveLength(5)
    // Each message replies to previous
  })
})
```

### Fluent Builder API

#### Basic Text Messages

```typescript
const msg = messageBuilder()
  .text('Hello world')
  .fromMe() // or .fromThem()
  .from('Alice')
  .read() // or .unread()
  .imessage() // or .sms()
  .date(new Date())
  .deliveredAt(new Date())
  .readAt(new Date())
  .replyTo('parent-guid')
  .subject('Subject line')
  .build()
```

#### Media Messages

```typescript
// Image
const img = messageBuilder()
  .image('photo.heic', '/abs/path/photo.heic')
  .fromMe()
  .build()

// Audio
const audio = messageBuilder().audio('voice.m4a').build()

// Video
const video = messageBuilder().video('clip.mov').build()

// PDF
const pdf = messageBuilder().pdf('document.pdf').build()

// Generic media
const media = messageBuilder()
  .media({
    filename: 'file.jpg',
    path: '/path/to/file.jpg',
    mediaKind: 'image',
  })
  .build()
```

#### Tapback Messages

```typescript
const tapback = messageBuilder().tapback('liked', 'parent-guid-123').from('Alice').build()
```

#### Notification Messages

```typescript
const notification = messageBuilder().notification('User left the conversation').build()
```

### Batch Builders

#### Conversation Thread

```typescript
const thread = conversationThread(5)
// Creates 5 messages where each replies to the previous
// Alternates between two speakers
```

#### Alternating Messages

```typescript
const messages = alternatingMessages(10)
// Creates 10 messages alternating between sent and received
// Spaced 1 minute apart
```

#### Media Collection

```typescript
const media = mediaMessages(2)
// Creates 2 of each: image, audio, video, pdf
// Total: 8 messages
```

#### Tapback Collection

```typescript
const tapbacks = tapbackMessages('parent-123', ['liked', 'loved', 'laughed'])
// Creates tapback messages for a parent
// One for each specified kind
```

#### Daily Pattern

```typescript
const daily = dailyMessagePattern('2025-10-19')
// Creates realistic daily message distribution:
// - Morning: 8am-11am (5 messages)
// - Afternoon: 12pm-5pm (8 messages)
// - Evening: 6pm-10pm (7 messages)
// Total: ~20 messages
```

---

## Integration Examples

### Complete Test Example

```typescript
import {
  messageBuilder,
  conversationThread,
  createMockProviderSuite,
  assertValidMessage,
  assertTextMessage,
  getValidationStats,
} from '../helpers'

describe('Complete Integration Example', () => {
  const mocks = createMockProviderSuite()

  beforeEach(() => {
    resetAllMocks(mocks)
  })

  it('should process conversation with enrichment', async () => {
    // Create test data
    const thread = conversationThread(5)
    const imgMsg = messageBuilder().image('photo.jpg', '/abs/path/photo.jpg').build()

    // Validate base messages
    thread.forEach((msg) => {
      assertValidMessage(msg)
      assertTextMessage(msg)
    })

    assertValidMessage(imgMsg)
    assertMediaMessage(imgMsg)

    // Mock enrichment
    const analysis = await mocks.geminiVision(imgMsg.media!.path)
    expect(analysis.visionSummary).toBeDefined()

    // Validation stats
    const stats = getValidationStats([...thread, imgMsg])
    expect(stats.validCount).toBe(6)
    expect(stats.byKind.text).toBe(5)
    expect(stats.byKind.media).toBe(1)
  })
})
```

### Fixture + Builder Combination

```typescript
describe('Mixed Data Sources', () => {
  it('should handle fixtures and builders together', () => {
    // Load existing fixtures
    const fixtureMessages = loadMessageFixture('real-data.json').messages

    // Build additional test messages
    const builderMessages = [
      messageBuilder().text('Extra test').build(),
      messageBuilder().image('test.jpg').build(),
    ]

    // Combine and validate
    const allMessages = [...fixtureMessages, ...builderMessages]
    const stats = getValidationStats(allMessages)

    expect(stats.validCount).toBe(allMessages.length)
  })
})
```

---

## Best Practices

### 1. Use Builders for Inline Data

```typescript
// ✅ Good: Readable, clear intent
const msg = messageBuilder().text('Hello').fromMe().build()

// ❌ Avoid: Verbose object literals in tests
const msg = {
  guid: 'test-123',
  messageKind: 'text',
  text: 'Hello',
  isFromMe: true,
  date: new Date().toISOString(),
  // ... many more required fields
}
```

### 2. Use Fixtures for Large Datasets

```typescript
// ✅ Good: Load from file
const messages = loadMessageFixture('large-dataset.json').messages

// ❌ Avoid: Creating 1000 messages inline
const messages = createMessagesFixture(1000)
```

### 3. Use Mocks for External Services

```typescript
// ✅ Good: Mock external API
const mocks = createMockProviderSuite()
const result = await mocks.geminiVision('/path')

// ❌ Avoid: Real API calls in tests
const realResult = await fetch('https://api.gemini.com/...')
```

### 4. Use Assertions for Clear Errors

```typescript
// ✅ Good: Clear error message
assertValidMessage(msg) // Throws with field-specific errors

// ❌ Avoid: Generic assertions
expect(MessageSchema.parse(msg)).toBeTruthy() // Unclear error
```

### 5. Combine Helpers for Complex Tests

```typescript
// ✅ Good: Use multiple helpers together
const thread = conversationThread(5) // Builder
const stats = getValidationStats(thread) // Assertion
const mocks = createMockProviderSuite() // Mock

// Test enrichment pipeline
for (const msg of thread) {
  assertValidMessage(msg)
  // ... enrich and test
}
```

---

## Testing the Helpers

Run tests for the helper utilities:

```bash
pnpm test tests/helpers/__tests__
```

---

## Adding New Helpers

When adding new helper functions:

1. **Add to appropriate module** (`mock-providers.ts`, `fixture-loaders.ts`, etc.)
2. **Export from `index.ts`** for easy importing
3. **Add tests** to `__tests__/test-helpers.test.ts`
4. **Update this README** with usage examples
5. **Use TypeScript** for type safety

Example:

```typescript
// In fixture-loaders.ts
export function createGroupChatFixture(participants: string[]): Message[] {
  // Implementation
}

// In index.ts
export * from './fixture-loaders'

// In __tests__/test-helpers.test.ts
describe('Group Chat Fixtures', () => {
  it('should create group chat', () => {
    const messages = createGroupChatFixture(['Alice', 'Bob', 'Charlie'])
    expect(messages.length).toBeGreaterThan(0)
  })
})

// In README.md
### Group Chat Fixtures
\`\`\`typescript
const messages = createGroupChatFixture(['Alice', 'Bob', 'Charlie'])
\`\`\`
```

---

## Related Documentation

- **Schema Documentation**: See `src/schema/message.ts` for Message type definitions
- **Test Configuration**: See `vitest.config.ts` for test setup
- **Global Test Setup**: See `tests/vitest/vitest-setup.ts` for global hooks

---

## Questions or Issues?

If you encounter issues with the test helpers or have suggestions for improvements, please:

1. Check the test files in `__tests__/` for working examples
2. Review the inline JSDoc comments in each module
3. Open an issue with a minimal reproduction case

---

**Last Updated**: 2025-10-19
**CI Task**: CI--T04 (Create test helper utilities)
