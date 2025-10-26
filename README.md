# iMessage Timeline

> Extract, enrich, and render your iMessage conversations into beautiful, AI-powered markdown timelines with full conversation threading and deep media analysis.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)
[![Tests](https://img.shields.io/badge/Tests-50%2B-brightgreen)](#testing)
[![Coverage](https://img.shields.io/badge/Coverage-70%25%2B-brightgreen)](#testing)

## Overview

**iMessage Timeline** is a sophisticated data pipeline that transforms your iMessage conversations into searchable, enriched markdown timelines. It intelligently extracts messages from multiple sources (iMazing CSV exports, macOS Messages.app SQLite database), deduplicates and links replies/reactions, enriches with AI-powered analysis (image descriptions, audio transcription, link summaries), and generates deterministic markdown files organized by date and time-of-day.

Perfect for creating browsable conversation archives, enriched research notes, or personal history exports.

### Key Features

- **Multiple Sources**: Ingest from iMazing CSV exports and macOS Messages.app database
- **Intelligent Linking**: Automatically link replies to parents and associate emoji reactions (tapbacks)
- **Smart Deduplication**: Merge CSV/DB sources with GUID matching and content equivalence detection
- **AI Enrichment**:
  - Image analysis (HEIC/TIFF→JPG previews + Gemini Vision captions)
  - Audio transcription (with speaker labels and timestamps)
  - PDF summarization
  - Link context extraction (Firecrawl + provider fallbacks)
- **Resumable Processing**: Checkpoint support for crash recovery and incremental enrichment for processing only new messages
- **Deterministic Output**: Identical input always produces identical markdown (reproducible pipelines)
- **Privacy-First**: Local-only mode, no API key persistence, full data control
- **Conversation Threading**: Nested replies and tapbacks rendered as readable blockquotes
- **Type-Safe**: 100% TypeScript with Zod schema validation

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/imessage-timeline.git
cd imessage-timeline

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# (Optional) Link for global CLI access
pnpm link
```

### Prerequisites

- **Node.js** 22.20+
- **macOS** (for database export; CSV import works on any OS)
- **Gemini API Key** (for AI enrichment, set via `GEMINI_API_KEY` env var)
- **Firecrawl API Key** (optional, for link enrichment; set via `FIRECRAWL_API_KEY`)

### Basic Usage

```bash
# Initialize config (creates imessage-config.yaml)
pnpm cli init

# Ingest CSV export from iMazing
pnpm cli ingest-csv -i messages.csv -o messages.csv.ingested.json

# Ingest from macOS Messages.app database
pnpm cli ingest-db -i db-export.json -o messages.db.ingested.json

# Normalize and link messages (merge sources, deduplicate, link replies)
pnpm cli normalize-link \
  -i messages.csv.ingested.json messages.db.ingested.json \
  -o messages.normalized.json

# Enrich with AI (images, audio, links)
pnpm cli enrich-ai \
  -i messages.normalized.json \
  -o messages.enriched.json \
  --enable-vision --enable-audio --enable-links

# Render to markdown
pnpm cli render-markdown \
  -i messages.enriched.json \
  -o ./timeline
```

Output: A `timeline/` directory with daily markdown files, one per date.

## Architecture

The pipeline follows a strict **4-stage architecture** with clear separation of concerns:

```
CSV/DB Exports
      │
      ├─────────────────┬──────────────────┐
      ▼                 ▼                  ▼
  Ingest-CSV       Ingest-DB         (Other sources)
      │                 │                  │
      └─────────────────┼──────────────────┘
                        ▼
              [Stage 1: Ingest]
              Parse & normalize
                        ▼
             messages.*.ingested.json
                        │
                        ▼
            [Stage 2: Normalize-Link]
            Deduplicate, link replies/tapbacks
                        ▼
             messages.normalized.json
                        │
                        ▼
              [Stage 3: Enrich-AI] ◄── Resumable & Incremental
              Add AI enrichments
                        ▼
            messages.enriched.json
                        │
                        ▼
             [Stage 4: Render-Markdown]
             Generate daily files
                        ▼
              timeline/*.md (output)
```

### Stage 1: Ingest

Extracts messages from CSV or SQLite database and normalizes to a unified schema.

**Responsibilities:**
- Parse rows with field mapping (handle CSV/DB dialect differences)
- Convert dates (CSV UTC → ISO 8601, Apple epoch → ISO 8601)
- Split rows into `text`/`media`/`notification`/`tapback` messages
- Resolve attachment paths to absolute paths when possible
- Create stable part GUIDs for multi-attachment DB messages: `p:<index>/<original_guid>`
- Preserve source metadata (CSV vs DB origin)

**Input:** iMazing CSV or Messages.app SQLite database
**Output:** Normalized `Message[]` in JSON envelope with metadata

### Stage 2: Normalize-Link

Merges multiple sources, deduplicates, links replies/tapbacks, and validates schema.

**Responsibilities:**
- Link replies to parents:
  - Primary: DB `association_guid` (database-native association)
  - Fallback: Heuristics (±30s timestamp proximity, text similarity, sender difference)
- Link tapbacks (emoji reactions) to message parts
- Deduplicate across CSV/DB sources:
  - Exact GUID matching (primary)
  - Content equivalence (fuzzy text match, same sender, same timestamp)
- Prefer DB-sourced data in conflicts (DB is authoritative for timestamps, handles, etc.)
- Enforce schema via Zod validation (camelCase, type correctness)

**Algorithm Complexity:** O(n log n) for deduplication with GUID indexing

**Input:** One or both ingest outputs
**Output:** Merged, deduplicated, linked `messages.normalized.json`

### Stage 3: Enrich-AI

Augments messages with AI-powered analysis. Fully resumable and idempotent.

**Responsibilities:**
- Image analysis:
  - Convert HEIC/TIFF to JPG preview (cached by filename)
  - Gemini Vision API: structured prompt for caption + summary
- Audio transcription:
  - Structured prompt requesting timestamps and speaker labels
  - Handles long audio with chunking (streaming for >10min files)
- PDF summarization (key points extraction)
- Link enrichment:
  - Firecrawl for full web scraping
  - Provider-specific fallbacks (YouTube, Spotify, Twitter, Instagram)
  - Generic HTML meta tag fallback
  - Graceful degradation (never crashes, stores error in enrichment)
- Idempotent processing (skip if enrichment kind already exists)
- Checkpointing (save progress every N items)
- Resumable (load checkpoint, verify config hash, continue from last index)
- Rate limiting (jittered backoff for API limits)
- Incremental mode (process only new message GUIDs vs prior state)

**Idempotency Key:** `(message.media.id, enrichment.kind)`

**Input:** `messages.normalized.json`, optional checkpoint/state files
**Output:** `messages.enriched.json` with populated `media.enrichment[]` arrays

### Stage 4: Render-Markdown

Generates deterministic daily markdown files organized by date and time-of-day.

**Responsibilities:**
- Group messages by calendar date
- Sub-group by time-of-day sections (Morning 00:00-11:59, Afternoon 12:00-17:59, Evening 18:00-23:59)
- Render each message with:
  - Timestamp anchor for deep linking
  - Sender name / "Me" indicator
  - Message text or media preview
  - Enrichments (image captions, transcriptions, link contexts) as formatted blockquotes
- Render replies as nested blockquotes (up to configurable depth)
- Render tapbacks as emoji reactions (❤️ for "loved", etc.)
- Deterministic sorting by `(date, guid)` for reproducibility

**Determinism:** Identical input → identical output. No randomization, stable key ordering.

**Input:** `messages.enriched.json`
**Output:** Daily markdown files (`timeline/YYYY-MM-DD.md`)

## Message Schema

The unified `Message` type represents all message kinds with a discriminated union:

```typescript
type Message = {
  guid: string                    // Unique identifier
  messageKind: 'text' | 'media' | 'tapback' | 'notification'
  date: string                    // ISO 8601 with Z suffix (UTC)
  isFromMe: boolean

  // Optional fields by kind
  text?: string                   // For text/notification messages
  media?: MediaMeta              // For media messages (see below)
  tapback?: TapbackInfo          // For tapback messages

  // Linking
  replyingTo?: ReplyInfo         // Links to parent message GUID

  // Metadata
  service: string                // SMS, iMessage, etc.
  handle?: string                // Phone number or Apple ID
  senderName?: string            // Display name
  groupGuid?: string             // For split messages, original DB GUID

  // Preservation fields
  subject?: string
  isAudioMessage?: boolean
  isDeleted?: boolean

  // Provenance
  sourceType?: 'csv' | 'db'
  sourceMetadata?: Record<string, unknown>
}

type MediaMeta = {
  id: string                      // Unique media ID
  type: 'image' | 'audio' | 'pdf' | 'video' | 'document'
  filename?: string
  path?: string                   // Absolute path if file exists
  mimeType?: string
  size?: number
  duration?: number               // For audio/video in seconds
  enrichment?: MediaEnrichment[]  // AI analysis results
  provenance?: {
    originalPath?: string
    source: 'csv' | 'db'
    lastSeen?: string
  }
}

type MediaEnrichment = {
  kind: 'image_analysis' | 'transcription' | 'pdf_summary' | 'link_context'
  content: Record<string, unknown>
  provider: string                // 'gemini', 'firecrawl', etc.
  model: string
  version: string
  createdAt: string              // ISO 8601
  error?: string                  // If enrichment failed
}
```

All dates are **ISO 8601 with Z suffix** (UTC). See [Dates and Timezones](#dates-and-timezones) for conversion details.

## CLI Commands

### Main Pipeline Commands

#### `ingest-csv`
Import messages from iMazing CSV export.

```bash
pnpm cli ingest-csv \
  -i messages.csv \
  -o messages.csv.ingested.json \
  -a ~/Library/Messages/Attachments \
  -a /Volumes/Backup/old-attachments
```

**Options:**
- `-i, --input <path>` - iMazing CSV file (required)
- `-o, --output <path>` - Output JSON file (default: `./messages.csv.ingested.json`)
- `-a, --attachments <dirs...>` - Root directories containing media files

#### `ingest-db`
Extract messages from macOS Messages.app SQLite database.

```bash
pnpm cli ingest-db \
  -i ~/Library/Messages/chat.db \
  -o messages.db.ingested.json \
  --contact john@example.com
```

**Options:**
- `-i, --input <path>` - Messages.app database file (required)
- `-o, --output <path>` - Output JSON file (default: `./messages.db.ingested.json`)
- `--contact <id>` - Filter by contact (phone or Apple ID)
- `-a, --attachments <dirs...>` - Attachment root directories

#### `normalize-link`
Merge sources, deduplicate, link replies/tapbacks, and validate schema.

```bash
pnpm cli normalize-link \
  -i messages.csv.ingested.json messages.db.ingested.json \
  -o messages.normalized.json \
  -m all
```

**Options:**
- `-i, --input <paths...>` - Input JSON files (required, can specify multiple)
- `-o, --output <path>` - Output JSON file (default: `./messages.normalized.json`)
- `-m, --merge-strategy <strategy>` - `exact` (GUID only) | `content` (content equivalence) | `all` (both, default)

#### `enrich-ai`
Augment messages with AI analysis (images, audio, links). Resumable and incremental.

```bash
pnpm cli enrich-ai \
  -i messages.normalized.json \
  -o messages.enriched.json \
  --resume \
  --incremental \
  --rate-limit 1000 \
  --max-retries 3 \
  --checkpoint-interval 100 \
  --enable-vision --enable-audio --enable-links \
  -v
```

**Options:**
- `-i, --input <path>` - Input normalized JSON (required)
- `-o, --output <path>` - Output JSON file (default: `./messages.enriched.json`)
- `-c, --checkpoint-dir <path>` - Checkpoint directory (default: `./.checkpoints`)
- `--resume` - Resume from last checkpoint
- `--incremental` - Only enrich messages new since last enrichment run
- `--state-file <path>` - Path to incremental state file (default: `./.imessage-state.json`)
- `--reset-state` - Clear incremental state and enrich all messages
- `--rate-limit <ms>` - Delay between API calls (default: 1000)
- `--max-retries <n>` - Max retries on API errors (default: 3)
- `--checkpoint-interval <n>` - Save checkpoint every N items (default: 100)
- `--enable-vision` - Enable image analysis (default: true)
- `--enable-audio` - Enable audio transcription (default: true)
- `--enable-links` - Enable link enrichment (default: true)

#### `render-markdown`
Generate daily markdown files from enriched messages.

```bash
pnpm cli render-markdown \
  -i messages.enriched.json \
  -o ./timeline \
  --group-by-time \
  --nested-replies \
  --max-nesting-depth 10 \
  --start-date 2025-01-01 \
  --end-date 2025-12-31
```

**Options:**
- `-i, --input <path>` - Input enriched JSON (required)
- `-o, --output <path>` - Output directory (default: `./timeline`)
- `--group-by-time` - Group by Morning/Afternoon/Evening (default: true)
- `--nested-replies` - Render replies as blockquotes (default: true)
- `--max-nesting-depth <n>` - Max blockquote nesting depth (default: 10)
- `--start-date <YYYY-MM-DD>` - Filter messages from this date
- `--end-date <YYYY-MM-DD>` - Filter messages until this date

### Utility Commands

#### `validate`
Validate JSON file against Message schema.

```bash
pnpm cli validate -i messages.json [-q]
```

**Options:**
- `-i, --input <path>` - JSON file to validate (required)
- `-q, --quiet` - Suppress detailed error output

**Output:** Exit code 0 on success, 1 on validation failure. Prints summary stats.

#### `stats`
Show statistics about a message file.

```bash
pnpm cli stats -i messages.json [-v]
```

**Options:**
- `-i, --input <path>` - JSON file (required)
- `-v, --verbose` - Show per-kind breakdown

**Output:** Message count, breakdown by `messageKind`, date range, attachment count, etc.

#### `doctor`
Run system diagnostics.

```bash
pnpm cli doctor [-v]
```

**Checks:**
- Node.js version (22+)
- Dependencies (pnpm packages)
- Config file exists and is readable
- API keys present (GEMINI_API_KEY, FIRECRAWL_API_KEY)
- Attachment directories accessible
- Write permissions to output directories

#### `init`
Generate starter configuration file.

```bash
pnpm cli init [-f json|yaml] [--force] [-o custom-path.yaml]
```

**Options:**
- `-f, --format <format>` - `json` or `yaml` (default: yaml)
- `--force` - Overwrite existing config
- `-o, --output <path>` - Custom config path

## Configuration

Configuration can be provided via `imessage-config.yaml` or `imessage-config.json`. Create with `pnpm cli init` or manually:

```yaml
version: "1.0"

# Attachment directories to search for media files
attachmentRoots:
  - ~/Library/Messages/Attachments
  - /Volumes/Backup/old-attachments

# Google Gemini API configuration
gemini:
  apiKey: ${GEMINI_API_KEY}         # Loaded from environment
  model: gemini-1.5-pro              # Recommended model
  rateLimitDelay: 1000               # Milliseconds between requests
  maxRetries: 3                       # Retry failed API calls

# Firecrawl (link enrichment) configuration
firecrawl:
  apiKey: ${FIRECRAWL_API_KEY}       # Optional, for link context
  enabled: true

# Enrichment settings
enrichment:
  enableVisionAnalysis: true          # Image captions/summaries
  enableAudioTranscription: true      # Audio transcription
  enableLinkEnrichment: true          # Link context extraction
  imageCacheDir: ./.cache/images      # Preview cache location
  checkpointInterval: 100             # Items per checkpoint
  forceRefresh: false                 # Re-enrich existing

# Rendering settings
render:
  groupByTimeOfDay: true              # Morning/Afternoon/Evening sections
  renderRepliesAsNested: true         # Blockquote threading
  renderTapbacksAsEmoji: true         # ❤️ instead of text
  maxNestingDepth: 10                 # Max blockquote levels
```

**Environment Variables:**
- `GEMINI_API_KEY` - Google Gemini API key (required for enrichment)
- `FIRECRAWL_API_KEY` - Firecrawl API key (optional, for link enrichment)
- `TF_BUILD` - Set by CI systems (enables test reporters)

**Config Loading:**
- Looks for `imessage-config.yaml` or `imessage-config.json` in current directory
- Supports environment variable expansion: `${VARIABLE_NAME}`
- CLI `--config` flag overrides default path

## Data Flows & Examples

### Example 1: Single Source (CSV Only)

```bash
# Ingest CSV
pnpm cli ingest-csv -i messages.csv -o messages.ingested.json

# Normalize (single source, minimal work)
pnpm cli normalize-link -i messages.ingested.json -o messages.normalized.json

# Enrich (first time, all messages)
pnpm cli enrich-ai -i messages.normalized.json -o messages.enriched.json

# Render
pnpm cli render-markdown -i messages.enriched.json -o ./timeline
```

### Example 2: Dual Source with Incremental Enrichment

```bash
# Ingest both sources
pnpm cli ingest-csv -i messages.csv -o messages.csv.ingested.json
pnpm cli ingest-db -i ~/Library/Messages/chat.db -o messages.db.ingested.json

# Normalize and merge
pnpm cli normalize-link \
  -i messages.csv.ingested.json messages.db.ingested.json \
  -o messages.normalized.json

# First enrichment
pnpm cli enrich-ai \
  -i messages.normalized.json \
  -o messages.enriched.json \
  --checkpoint-interval 100

# Later: new messages added, re-run incrementally
pnpm cli enrich-ai \
  -i messages.normalized.json \
  -o messages.enriched.json \
  --incremental \
  --resume
```

### Example 3: Resuming from Crash

```bash
# Enrichment stops mid-way (power loss, API timeout, etc.)
# Checkpoint saved: .checkpoints/enrich-checkpoint-abc123def.json

# Resume from checkpoint
pnpm cli enrich-ai \
  -i messages.normalized.json \
  -o messages.enriched.json \
  --resume
# → Continues from last processed index automatically
```

## Dates and Timezones

All dates in JSON outputs are **ISO 8601 UTC with Z suffix** (e.g., `2025-10-26T14:30:45.000Z`).

### CSV Import
- iMazing CSV format: `MM/DD/YYYY, HH:MM:SS` (local timezone, interpreted as UTC)
- Converted to ISO 8601 with Z suffix

### Database Import
- Apple epoch: Seconds since 2001-01-01 00:00:00 UTC
- Formula: `ISO = (appleSeconds + 978307200) * 1000` (convert to milliseconds, then to ISO)
- Result: ISO 8601 with Z suffix

### Markdown Rendering
- Timestamps displayed in UTC
- Grouped by calendar date (UTC)
- To display in local timezone, render the timestamp differently in post-processing

## Idempotency and Determinism

### Idempotent Enrichment

Enrichment is **idempotent** by design:
- Check if `enrichment.kind` already exists for a message
- Skip if present (already enriched)
- Use `--force-refresh` to re-enrich specific kinds

```bash
# First run: enrich all
pnpm cli enrich-ai -i messages.normalized.json -o messages.enriched.json

# Later: add new enrichment kind (e.g., link context)
# Existing image/audio enrichments preserved, new kind added
pnpm cli enrich-ai -i messages.normalized.json -o messages.enriched.json \
  --enable-links  # Other kinds disabled
```

### Deterministic Rendering

Markdown output is **fully deterministic**:
- Messages sorted by `(date, guid)` before rendering
- Enrichments sorted by kind within each message
- JSON keys in sorted order
- No randomization or time-dependent output

This means: `sha256(messages.enriched.json) → sha256(timeline/*.md)` is consistent across runs.

### Checkpoint Consistency

Checkpoints include config hash verification:
- Each checkpoint stores SHA256 of enrichment config
- Resume only if config unchanged
- Detects breaking changes (API key updates, disable/enable analysis modes)

## Performance & Optimization

### Concurrency

- **Ingest** (Stage 1): Single-threaded, fast (CSV parsing ~10k msgs/s)
- **Normalize-Link** (Stage 2): Single-threaded, O(n log n) complexity (~1k msgs/s for dedup)
- **Enrich-AI** (Stage 3): API call bound, respectful rate limiting (1-5 msgs/min depending on Gemini quota)
- **Render** (Stage 4): Single-threaded, fast (~10k msgs/s)

### Memory

- **Streaming where possible**: Large JSON files loaded once into memory
- **Checkpoint interval**: Default 100 items keeps memory bounded
- **Image cache**: Reuses converted previews by filename

### Cost Optimization

- **Incremental mode**: Only enrich new messages (~80% cost reduction for mature datasets)
- **Selective enrichment**: Enable/disable analysis modes (`--enable-vision`, etc.)
- **Image caching**: Preview conversion cached by filename (avoid re-processing)
- **Fallback chain**: Use Firecrawl fallback before provider-specific parsing (reduce API calls)

### Suggested Workflow

```bash
# Initial run (expensive, one-time)
pnpm cli enrich-ai -i normalized.json -o enriched.json --checkpoint-interval 100

# Later: weekly incremental updates (cheap)
pnpm cli enrich-ai -i normalized.json -o enriched.json --incremental --resume

# Yearly: full re-enrichment with new models
pnpm cli enrich-ai -i normalized.json -o enriched.json --force-refresh
```

## Advanced Usage

### Merging Multiple CSV/DB Exports

Combine multiple conversations into a single timeline:

```bash
# Ingest each conversation separately
pnpm cli ingest-csv -i chat-with-alice.csv -o alice.ingested.json
pnpm cli ingest-csv -i chat-with-bob.csv -o bob.ingested.json

# Merge into single normalized file
pnpm cli normalize-link \
  -i alice.ingested.json bob.ingested.json \
  -o messages.normalized.json

# Enrich and render as single timeline
pnpm cli enrich-ai -i messages.normalized.json -o messages.enriched.json
pnpm cli render-markdown -i messages.enriched.json -o ./timeline
```

### Selective Date Range Rendering

Render only recent messages:

```bash
pnpm cli render-markdown \
  -i messages.enriched.json \
  -o ./timeline \
  --start-date 2025-10-01 \
  --end-date 2025-10-31
```

### Upgrading Enrichment Models

Re-enrich with newer Gemini models:

```bash
# Update config with new model
# imessage-config.yaml:
# gemini:
#   model: gemini-2-flash  # (hypothetical future model)

# Re-enrich with new model
pnpm cli enrich-ai \
  -i messages.normalized.json \
  -o messages.enriched.json \
  --force-refresh
```

## Testing

The project includes 50+ test files covering:
- Schema validation (happy path + invariant violations)
- CSV/DB ingestion (parsing, path resolution, date conversion)
- Linking algorithms (reply matching, tapback association)
- Deduplication (GUID matching, content equivalence)
- Enrichment idempotency (skip logic, force-refresh)
- Checkpoint recovery (save/load, config hash verification)
- Rendering (grouping, sorting, determinism)

### Run Tests

```bash
# All tests
pnpm test

# Watch mode (re-run on file change)
pnpm test --watch

# Coverage report
pnpm test:coverage
```

### Coverage

Maintained at **70%+ branch coverage**. Critical paths (linking, dedup, enrichment) at 95%+.

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add tests for new functionality
4. Ensure tests pass: `pnpm test`
5. Format code: `pnpm format`
6. Lint: `pnpm lint`
7. Commit with semantic message: `git commit -m "feat: add amazing feature"`
8. Push and create a pull request

### Development Setup

```bash
# Install with dev dependencies
pnpm install

# Start watch mode (auto-rebuild TypeScript)
pnpm watch

# Run tests in watch mode during development
pnpm test --watch

# Check code quality before committing
pnpm quality-check
```

### Code Style

- **TypeScript**: Strict mode, no `any`
- **Formatting**: Prettier with 80-char line limit
- **Linting**: ESLint with recommended rules
- **Testing**: Vitest with 70%+ coverage threshold
- **Commits**: Conventional commits (feat:, fix:, docs:, etc.)

## Troubleshooting

### "API rate limit exceeded"

**Solution:** Increase `--rate-limit` delay
```bash
pnpm cli enrich-ai -i messages.normalized.json -o enriched.json --rate-limit 2000
```

### "Checkpoint config hash mismatch"

**Cause:** Changed enrichment config (API key, enable/disable analysis)
**Solution:** Use `--reset-state` to clear or manually delete `.imessage-state.json`
```bash
pnpm cli enrich-ai -i messages.normalized.json -o enriched.json --reset-state
```

### "Attachment paths not resolved"

**Cause:** Media file not found in attachment directories
**Check:**
1. Verify path in config (`attachmentRoots`)
2. Check file exists on disk
3. Check file permissions
**Result:** Path stored as filename with provenance metadata

### "Validation errors in normalized.json"

**Debug:**
```bash
pnpm cli validate -i messages.normalized.json -v
# Shows which fields failed validation
```

**Common causes:**
- Missing `messageKind` field
- Date not in ISO 8601 UTC format
- Inconsistent data types (string vs number)

Run `pnpm cli doctor` for system-level diagnostics.

## FAQ

**Q: Can I use this on Linux/Windows?**
A: CSV ingestion works everywhere. Database ingestion requires macOS (to access Messages.app). You can export from macOS and process on other systems.

**Q: How much storage do the outputs take?**
A: Enriched JSON is typically 2-3x original normalized JSON (due to enrichment data). Markdown files are 1-2x enriched JSON. A 1000-message conversation: ~5-10MB JSON, ~10-20MB markdown.

**Q: Can I re-use enriched.json if I change the render config?**
A: Yes! Rendering is deterministic and config-independent. Change render settings (grouping, nesting depth) and re-render without re-enriching.

**Q: What if I don't have API keys?**
A: Enrichment skips (messages remain as-is). Set `--enable-vision false --enable-audio false --enable-links false` to disable. Rendering still works perfectly without enrichment.

**Q: How do I update my timeline when new messages arrive?**
A: Re-export from Messages.app/iMazing, then run the full pipeline OR use `--incremental --resume` to process only new messages (80%+ faster).

**Q: Is my data private?**
A: Yes. All processing is local. API calls to Gemini/Firecrawl are necessary for enrichment but never persist to artifacts. No data retained after processing. Set API keys via environment variables (not in config files).

## Technical Details

### Schema Invariants

Messages enforce cross-field constraints via Zod `superRefine()`:
- `messageKind='media'` → `media` field must exist and be complete
- `messageKind='tapback'` → `tapback` field must exist
- `messageKind='text'|'notification'` → may have text, must not have media/tapback
- All dates must be ISO 8601 with Z suffix

### Linking Heuristics

Reply linking uses a confidence-scoring algorithm:
1. Check DB association (if present, use immediately)
2. Search ±30s timestamp window
3. Score candidates:
   - Timestamp distance: closer = higher score
   - Text similarity: matching keywords = higher score
   - Sender difference: different person = higher score (likely replying)
4. Select highest score (or log as ambiguous if tie)

### Deduplication Strategy

CSV/DB deduplication uses a multi-pass approach:
1. Exact GUID matching (primary)
2. Content equivalence (fuzzy text + same sender + same timestamp)
3. Prefer DB values in conflicts (authoritiveness)
4. Sort by GUID for determinism

### Idempotency Design

Enrichment is idempotent via kind-based deduplication:
- Each enrichment entry has a `kind` (e.g., `'image_analysis'`, `'transcription'`)
- Check if `kind` already exists before enriching
- `forceRefresh` replaces specific kind (preserves others)
- Result: Safe to re-run without duplicating enrichments

## Roadmap

- [ ] Support for WhatsApp, Telegram exports
- [ ] Batch API calls to reduce Gemini quota usage
- [ ] Vector embeddings for similarity search
- [ ] Web UI for browsing/searching timeline
- [ ] Obsidian plugin for live sync
- [ ] Self-hosted LLM support (Ollama, etc.)
- [ ] Photo gallery view alongside markdown
- [ ] Sentiment analysis and conversation metrics
- [ ] Anonymous mode (redact PII)

## License

MIT © 2025

See [LICENSE](LICENSE) file for full text.

## Related Projects

- [iMazing](https://imazing.com/) - CSV export source
- [Firecrawl](https://www.firecrawl.dev/) - Link enrichment API
- [Google Gemini](https://ai.google.dev/) - Image/audio analysis API
- [Obsidian](https://obsidian.md/) - Markdown vault system

## Contact & Support

- **Issues & Bugs**: [GitHub Issues](https://github.com/yourusername/imessage-timeline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/imessage-timeline/discussions)
- **Email**: support@example.com (replace with actual contact)

---

**Enjoying iMessage Timeline?** Please star ⭐ the repo and share with friends!
