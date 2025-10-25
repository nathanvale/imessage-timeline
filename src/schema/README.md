# Message Schema Documentation

## Overview

This directory contains the unified Message schema for the iMessage pipeline project. The schema is implemented using TypeScript interfaces and Zod validators to ensure both compile-time type safety and runtime validation.

## Files

- `message.ts` - Main schema file containing all types and Zod schemas

## Schema Structure

### Type Aliases

- `MessageGUID` - String identifier for messages
- `ChatId` - String identifier for chats
- `MediaKind` - Enum: 'image' | 'audio' | 'video' | 'pdf' | 'unknown'

### Core Interfaces

#### `Message`
The main message interface with a discriminated union on `messageKind`:
- `'text'` - Text message
- `'media'` - Media message (requires `media` payload)
- `'tapback'` - Reaction message (requires `tapback` payload)
- `'notification'` - System notification message

#### `MessageCore`
Base interface containing shared fields across all message types including:
- Identity: `guid`, `rowid`, `chatId`
- Metadata: `service`, `handle`, `subject`
- Dates: `date`, `dateRead`, `dateDelivered`, `dateEdited`
- Thread info: `threadOriginatorGuid`, `numReplies`

#### `MediaMeta`
Represents a single media item with:
- Identity: `id`, `filename`, `path`
- Metadata: `size`, `mimeType`, `uti`, `mediaKind`
- AI enrichment: `enrichment` array

#### `MediaEnrichment`
AI-generated enrichment data with provider provenance:
- Image: `visionSummary`, `shortDescription`
- Audio: `transcript`
- Link: `url`, `title`, `summary`
- Provenance: `provider`, `model`, `version`, `createdAt`

#### `TapbackInfo`
Reaction metadata:
- Type: 'loved' | 'liked' | 'disliked' | 'laughed' | 'emphasized' | 'questioned' | 'emoji'
- Action: 'added' | 'removed'
- Target: `targetMessageGuid`, `targetMessagePart`, `targetText`

#### `ReplyInfo`
Reply metadata:
- Context: `sender`, `date`, `text`
- Target: `targetMessageGuid`

#### `ExportEnvelope`
Container for JSON exports:
- Metadata: `schemaVersion`, `source`, `createdAt`
- Payload: `messages` array
- Extensions: `meta` record

## Validation Rules

### Cross-Field Invariants (enforced via `superRefine`)

1. **Media Messages (SCHEMA-T01-AC03)**
   - If `messageKind = 'media'` → `media` payload MUST exist
   - Media payload MUST have: `id`, `filename`, `path`
   - Non-media messages MUST NOT carry `media` payload

2. **Tapback Messages (SCHEMA-T01-AC04)**
   - If `messageKind = 'tapback'` → `tapback` payload MUST exist

3. **Date Validation (SCHEMA-T01-AC05)**
   - All date fields MUST be ISO 8601 with Z suffix (UTC)
   - Note: Zod's `datetime()` validator requires Z suffix specifically (e.g., `2025-10-17T10:00:00.000Z`)
   - Timezone offsets (e.g., `+11:00`) are NOT accepted by Zod's built-in validator
   - Validated fields: `date`, `dateRead`, `dateDelivered`, `dateEdited`, `exportTimestamp`
   - Nested dates: `replyingTo.date`, `enrichment.createdAt`

4. **Path Validation (SCHEMA-T01-AC06)**
   - `media.path` MUST be absolute (start with `/`) when present
   - Null paths allowed only for missing files (filename retained for provenance)

## Usage

### Importing

```typescript
import {
  // Types
  Message,
  MessageCore,
  MediaMeta,
  MediaEnrichment,
  TapbackInfo,
  ReplyInfo,
  ExportEnvelope,

  // Schemas
  MessageSchema,
  MessageCoreSchema,
  MediaMetaSchema,
  MediaEnrichmentSchema,
  TapbackInfoSchema,
  ReplyInfoSchema,
  ExportEnvelopeSchema,
} from './src/schema/message.ts'
```

### Validating Data

```typescript
import { MessageSchema } from './src/schema/message.ts'

// Parse and validate
const result = MessageSchema.safeParse(data)

if (result.success) {
  const message = result.data
  // Use validated message
} else {
  console.error('Validation errors:', result.error)
}
```

### Creating Messages

```typescript
// Text message
const textMessage: Message = {
  guid: 'msg-123',
  isFromMe: true,
  date: '2025-10-17T10:00:00.000Z',
  messageKind: 'text',
  text: 'Hello world',
}

// Media message
const mediaMessage: Message = {
  guid: 'msg-456',
  isFromMe: false,
  date: '2025-10-17T10:05:00.000Z',
  messageKind: 'media',
  media: {
    id: 'media-123',
    filename: 'photo.jpg',
    path: '/absolute/path/to/photo.jpg',
    mediaKind: 'image',
  },
}

// Tapback message
const tapbackMessage: Message = {
  guid: 'msg-789',
  isFromMe: true,
  date: '2025-10-17T10:10:00.000Z',
  messageKind: 'tapback',
  tapback: {
    type: 'loved',
    action: 'added',
    targetMessageGuid: 'msg-456',
  },
}
```

## Schema Version

Current schema version: `2.0.0`

## Acceptance Criteria Status

All acceptance criteria for SCHEMA-T01 have been implemented:

- ✅ **SCHEMA-T01-AC01**: Message interface with messageKind discriminated union
- ✅ **SCHEMA-T01-AC02**: Zod schema with superRefine for cross-field invariants
- ✅ **SCHEMA-T01-AC03**: Media payload validation (exists and complete when messageKind='media')
- ✅ **SCHEMA-T01-AC04**: Tapback payload validation (exists when messageKind='tapback')
- ✅ **SCHEMA-T01-AC05**: ISO 8601 date validation with Z suffix enforced
- ✅ **SCHEMA-T01-AC06**: Absolute path validation for media.path when file exists

## Testing

Run the verification script to test the schema:

```bash
node scripts/verify-schema.mjs
```

This script validates:
- All schemas load without errors
- Basic message parsing works
- Cross-field invariants are enforced
- Date validation with Z suffix is enforced
- Invalid messages are rejected appropriately
