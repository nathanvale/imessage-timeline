# Configuration Module

**Task**: CONFIG--T01 - Define Config Schema **Status**: ✅ Complete

## Overview

This module provides Zod-based schema validation for iMessage Timeline
configuration files. Supports both JSON and YAML formats with environment
variable interpolation.

## Files

### `schema.ts`

Core configuration schema with Zod validation.

**Exports**:

- `ConfigSchema` - Main Zod schema
- `Config` - TypeScript type
- `validateConfig()` - Parse and validate config (throws on error)
- `validateConfigSafe()` - Parse with success/error result
- `DEFAULT_CONFIG` - Default values
- `CONFIG_FILE_PATTERNS` - Discovery patterns
- `detectConfigFormat()` - Detect JSON/YAML from filename

## Usage

### Basic Validation

```typescript
import { validateConfig } from './config/schema'

const config = {
  gemini: {
    apiKey: 'your-api-key',
  },
}

try {
  const validated = validateConfig(config)
  console.log(validated.gemini.model) // 'gemini-1.5-pro' (default)
} catch (error) {
  console.error(error.errors)
}
```

### Safe Validation (No Throw)

```typescript
import { validateConfigSafe } from './config/schema'

const result = validateConfigSafe(config)

if (result.success) {
  console.log(result.data.gemini.apiKey)
} else {
  result.errors?.forEach((err) => {
    console.error(`${err.path}: ${err.message}`)
  })
}
```

### Format Detection

```typescript
import { detectConfigFormat } from './config/schema'

const format = detectConfigFormat('./imessage-config.yaml')
// => 'yaml'

const format2 = detectConfigFormat('./imessage-config.json')
// => 'json'
```

## Configuration Structure

### Required Fields

- `gemini.apiKey` - Gemini API key (min 1 character)

### Optional Fields with Defaults

| Field                                 | Default                              | Description                  |
| ------------------------------------- | ------------------------------------ | ---------------------------- |
| `version`                             | `"1.0"`                              | Config version               |
| `attachmentRoots`                     | `["~/Library/Messages/Attachments"]` | Attachment search paths      |
| `gemini.model`                        | `"gemini-1.5-pro"`                   | Gemini model name            |
| `gemini.rateLimitDelay`               | `1000`                               | Delay between API calls (ms) |
| `gemini.maxRetries`                   | `3`                                  | Max retry attempts           |
| `firecrawl`                           | `undefined`                          | Optional Firecrawl config    |
| `enrichment.enableVisionAnalysis`     | `true`                               | Enable image analysis        |
| `enrichment.enableAudioTranscription` | `true`                               | Enable audio transcription   |
| `enrichment.enableLinkEnrichment`     | `true`                               | Enable link context          |
| `enrichment.imageCacheDir`            | `"./.cache/images"`                  | Preview cache location       |
| `enrichment.checkpointInterval`       | `100`                                | Checkpoint frequency         |
| `enrichment.forceRefresh`             | `false`                              | Re-enrich existing           |
| `render.groupByTimeOfDay`             | `true`                               | Time grouping                |
| `render.renderRepliesAsNested`        | `true`                               | Nested replies               |
| `render.renderTapbacksAsEmoji`        | `true`                               | Emoji tapbacks               |
| `render.maxNestingDepth`              | `10`                                 | Max reply depth              |

### Numeric Constraints

- `gemini.rateLimitDelay`: ≥ 0
- `gemini.maxRetries`: 0-10
- `enrichment.checkpointInterval`: 1-10000
- `render.maxNestingDepth`: 1-100

## File Formats

### YAML (Recommended)

```yaml
# CONFIG-T01-AC02: YAML format support
# CONFIG-T01-AC03: Environment variable interpolation

version: '1.0'

gemini:
  apiKey: ${GEMINI_API_KEY}
  model: gemini-1.5-pro

enrichment:
  checkpointInterval: 100
```

**Discovery Order**:

1. `./imessage-config.yaml`
2. `./imessage-config.yml`
3. `./imessage-config.json`

### JSON

```json
{
  "gemini": {
    "apiKey": "${GEMINI_API_KEY}",
    "model": "gemini-1.5-pro"
  },
  "version": "1.0"
}
```

## Environment Variable Interpolation

**Pattern**: `${ENV_VAR}`

```yaml
gemini:
  apiKey: ${GEMINI_API_KEY} # Replaced at runtime

firecrawl:
  apiKey: ${FIRECRAWL_API_KEY}
```

**Note**: Actual substitution is implemented in CONFIG--T02 (config loader).

## Error Formatting

CONFIG-T01-AC05: Validation errors include field paths and expected types.

```typescript
const result = validateConfigSafe({
  gemini: {
    apiKey: '',
    maxRetries: 20,
  },
  attachmentRoots: [],
})

// result.errors:
// [
//   { path: 'gemini.apiKey', message: 'Gemini API key is required' },
//   { path: 'gemini.maxRetries', message: 'Number must be less than or equal to 10' },
//   { path: 'attachmentRoots', message: 'At least one attachment root is required' }
// ]
```

## Examples

See `examples/` directory:

- `imessage-config.yaml` - Full YAML example
- `imessage-config.json` - Full JSON example
- `imessage-config-minimal.yaml` - Minimal config with defaults

## Testing

Run config schema tests:

```bash
pnpm test src/config/__tests__/schema.test.ts
```

**Coverage**: 22 tests covering:

- Schema validation (minimal, full, defaults)
- Required field enforcement
- Numeric constraint validation
- Error formatting
- Format detection
- Config discovery patterns

## Next Steps

**CONFIG--T02**: Implement config loader with:

- File discovery
- YAML/JSON parsing
- Environment variable substitution
- Precedence (CLI > env > file > defaults)
- Caching

---

**Completion**: CONFIG--T01 ✅ (2025-10-19) **Tests**: 22/22 passing **Files**:
2 (schema.ts, schema.test.ts)
