# iMessage Pipeline Usage Guide

**Version**: 1.0 **Last Updated**: 2025-10-19 **Project**: iMessage Timeline
Refactor

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Environment Setup](#environment-setup)
4. [Pipeline Stages](#pipeline-stages)
5. [End-to-End Workflow](#end-to-end-workflow)
6. [Configuration Reference](#configuration-reference)
7. [CLI Commands](#cli-commands)
8. [Advanced Usage](#advanced-usage)

---

## Quick Start

**Prerequisites**:

- Node.js ≥22.20
- pnpm package manager
- Gemini API key (for enrichment)
- Firecrawl API key (optional, for link enrichment)

**Minimal workflow**:

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add your API keys

# 3. Run the pipeline
pnpm dev ingest-csv --input messages.csv --output ingested.json
pnpm dev normalize-link --input ingested.json --output normalized.json
pnpm dev enrich-ai --input normalized.json --output enriched.json
pnpm dev render-markdown --input enriched.json --output-dir ./timeline
```

---

## Installation

### From Source

```bash
# Clone repository
git clone https://github.com/yourusername/chatline.git
cd chatline

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run tests (optional)
pnpm test
```

### Package Manager

```bash
# Via npm
npm install -g /chatline

# Via pnpm
pnpm add -g /chatline
```

---

## Environment Setup

### Required Environment Variables

Create a `.env` file in the project root:

```bash
# Gemini API (Required for enrichment)
GEMINI_API_KEY=your_gemini_api_key_here

# Firecrawl API (Optional, for link enrichment)
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### Obtaining API Keys

#### Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key and add to `.env`

**Pricing**: Free tier includes 15 RPM (requests per minute) with generous
quotas.

#### Firecrawl API Key (Optional)

1. Visit [Firecrawl](https://www.firecrawl.dev/)
2. Sign up for an account
3. Navigate to API Keys section
4. Copy the key and add to `.env`

**Note**: Firecrawl is optional. Link enrichment will fall back to
provider-specific parsers (YouTube, Spotify, Twitter) without it.

---

## Pipeline Stages

The pipeline consists of 4 main stages:

```
┌─────────────┐    ┌────────────────┐    ┌───────────┐    ┌─────────────────┐
│   Ingest    │ -> │ Normalize-Link │ -> │ Enrich-AI │ -> │ Render-Markdown │
└─────────────┘    └────────────────┘    └───────────┘    └─────────────────┘
   CSV or DB         Dedupe + Link         AI Analysis      Obsidian Format
```

### Stage 1: Ingest

**Purpose**: Import messages from CSV (iMazing) or macOS Messages.app database.

**Inputs**:

- CSV file exported from iMazing
- OR macOS Messages.app database (`chat.db`)

**Outputs**: JSON array of normalized message objects

**See**: [Ingest Commands](#1-ingest-csv) for detailed usage

---

### Stage 2: Normalize-Link

**Purpose**: Deduplicate messages from multiple sources and link
replies/tapbacks.

**Inputs**: JSON messages from Stage 1

**Outputs**: Deduplicated, linked messages with:

- Reply threads (parent-child relationships)
- Tapback associations
- Unified GUIDs
- Absolute file paths

**See**: [Normalize-Link Commands](#3-normalize-link) for detailed usage

---

### Stage 3: Enrich-AI

**Purpose**: Add AI-powered analysis to media messages.

**Features**:

- **Image Analysis**: HEIC/TIFF → JPG conversion + Gemini Vision captions
- **Audio Transcription**: Speech-to-text with speaker labels
- **PDF Summarization**: Extract key points from documents
- **Video Metadata**: Basic metadata extraction (no transcription)
- **Link Enrichment**: Fetch context from URLs (Firecrawl + fallbacks)

**Inputs**: Normalized messages from Stage 2

**Outputs**: Enriched messages with `media.enrichment` arrays

**See**: [Enrich-AI Commands](#4-enrich-ai) for detailed usage

---

### Stage 4: Render-Markdown

**Purpose**: Generate Obsidian-compatible markdown timeline files.

**Features**:

- Group by date + time-of-day (Morning/Afternoon/Evening)
- Nested reply threads as blockquotes
- Tapback emoji reactions
- Image embeds with `![[wikilink]]` syntax
- Transcriptions and link contexts as blockquotes

**Inputs**: Enriched messages from Stage 3

**Outputs**: Markdown files in output directory

**See**: [Render-Markdown Commands](#5-render-markdown) for detailed usage

---

## End-to-End Workflow

### Example: Full Pipeline with Real Data

This example demonstrates processing 3 months of iMessage history.

#### 1. Export Messages from iMazing

1. Connect iPhone to iMazing
2. Navigate to "Messages" → Select contact
3. Export → CSV format
4. Save as `melanie-messages.csv`

#### 2. Prepare Environment

```bash
# Create project directory
mkdir imessage-analysis
cd imessage-analysis

# Install chatline
pnpm add /chatline

# Setup environment variables
cat > .env << EOF
GEMINI_API_KEY=AIzaSyD...your_key_here
FIRECRAWL_API_KEY=fc-...your_key_here (optional)
EOF
```

#### 3. Run Ingest Stage

```bash
pnpm chatline ingest-csv \
  --input melanie-messages.csv \
  --output ingested.json \
  --attachment-roots ~/Library/Messages/Attachments
```

**Expected output**:

```
✓ Parsed 2,847 messages from CSV
✓ Split into 3,104 message objects (text + media)
✓ Resolved 1,423 attachment paths
⚠ Missing files: 12 (logged to ingested-errors.json)
✓ Wrote ingested.json (4.2 MB)
```

#### 4. Run Normalize-Link Stage

```bash
pnpm chatline normalize-link \
  --input ingested.json \
  --output normalized.json \
  --verbose
```

**Expected output**:

```
✓ Loaded 3,104 messages
✓ Linked 847 replies (783 via DB, 64 via heuristics)
✓ Linked 234 tapbacks
✓ Deduplicated: 3,104 → 3,098 (6 duplicates removed)
✓ Validated all messages against schema
✓ Wrote normalized.json (4.1 MB)
```

#### 5. Run Enrich-AI Stage

```bash
pnpm chatline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --checkpoint-interval 50 \
  --rate-limit 1000 \
  --resume
```

**Expected output**:

```
✓ Loaded 3,098 messages (823 media attachments)
→ Enriching images: 542 HEIC/TIFF files
  → Converting HEIC to JPG previews... [=============    ] 75% (407/542)
  → Analyzing with Gemini Vision... [============     ] 70% (380/542)
✓ Checkpoint written: enrich-checkpoint-500.json
→ Enriching audio: 134 M4A files
  → Transcribing with Gemini Audio... [===========      ] 65% (87/134)
✓ Checkpoint written: enrich-checkpoint-600.json
→ Enriching links: 89 URLs
  → Fetching contexts... [==================] 100% (89/89)
✓ Completed in 42min 18s
✓ Wrote enriched.json (6.7 MB)
```

**Resume capability**: If interrupted (Ctrl+C or API error), run the same
command with `--resume` to continue from the last checkpoint.

#### 6. Run Render-Markdown Stage

```bash
pnpm chatline render-markdown \
  --input enriched.json \
  --output-dir ./timeline \
  --date-range 2024-10-01:2024-12-31
```

**Expected output**:

```
✓ Loaded 3,098 enriched messages
✓ Grouping by date: 92 days with messages
✓ Rendering markdown files...
  → 2024-10-01.md (34 messages)
  → 2024-10-02.md (28 messages)
  ...
  → 2024-12-31.md (41 messages)
✓ Wrote 92 markdown files to ./timeline/
✓ Total size: 8.4 MB
```

#### 7. View in Obsidian

1. Open Obsidian
2. File → Open Vault
3. Select `./timeline` directory
4. Navigate to any date file (e.g., `2024-10-15.md`)

**Result**: Fully formatted timeline with:

- ✅ Nested reply threads
- ✅ Tapback emoji reactions
- ✅ Embedded images with captions
- ✅ Audio transcriptions
- ✅ Link previews with context
- ✅ Clickable deep-link anchors

---

## Configuration Reference

### Global Configuration File

Create `imessage-config.json` in project root:

```json
{
  "attachmentRoots": [
    "/Users/yourname/Library/Messages/Attachments",
    "/Volumes/Backup/old-attachments"
  ],
  "enrichment": {
    "checkpointInterval": 100,
    "enableAudioTranscription": true,
    "enableLinkEnrichment": true,
    "enableVisionAnalysis": true,
    "forceRefresh": false,
    "imageCacheDir": "./.cache/images"
  },
  "firecrawl": {
    "apiKey": "${FIRECRAWL_API_KEY}",
    "enabled": true
  },
  "gemini": {
    "apiKey": "${GEMINI_API_KEY}",
    "maxRetries": 3,
    "model": "gemini-1.5-pro",
    "rateLimitDelay": 1000
  },
  "render": {
    "groupByTimeOfDay": true,
    "maxNestingDepth": 10,
    "renderRepliesAsNested": true,
    "renderTapbacksAsEmoji": true
  }
}
```

### Configuration Precedence

1. **CLI flags** (highest priority)
2. **Environment variables** (`.env` file)
3. **Config file** (`imessage-config.json`)
4. **Built-in defaults** (lowest priority)

**Example**:

```bash
# Uses GEMINI_API_KEY from .env
pnpm dev enrich-ai --input messages.json --output enriched.json

# Overrides with CLI flag
pnpm dev enrich-ai --input messages.json --output enriched.json --gemini-api-key YOUR_KEY
```

---

## CLI Commands

### 1. ingest-csv

Import messages from iMazing CSV export.

**Syntax**:

```bash
chatline ingest-csv [options]
```

**Options**:

| Flag                            | Type     | Default                          | Description                   |
| ------------------------------- | -------- | -------------------------------- | ----------------------------- |
| `--input <path>`                | string   | _(required)_                     | Path to CSV file              |
| `--output <path>`               | string   | `ingested.json`                  | Output JSON file              |
| `--attachment-roots <paths...>` | string[] | `~/Library/Messages/Attachments` | Attachment search directories |
| `--verbose`                     | boolean  | `false`                          | Detailed logging              |

**Example**:

```bash
chatline ingest-csv \
  --input ~/Desktop/export.csv \
  --output ./data/ingested.json \
  --attachment-roots ~/Library/Messages/Attachments /Volumes/Backup/attachments \
  --verbose
```

**Output**: JSON file with structure:

```json
{
  "messages": [
    {
      "date": "2024-10-15T14:23:45.000Z",
      "guid": "csv:1:0",
      "isFromMe": true,
      "messageKind": "text",
      "metadata": {
        "csvLineNumber": 2,
        "source": "csv"
      },
      "service": "iMessage",
      "text": "Hello world"
    }
  ],
  "metadata": {
    "createdAt": "2025-10-19T22:00:00.000Z",
    "source": "csv",
    "totalMessages": 1234,
    "version": "1.0"
  }
}
```

---

### 2. ingest-db

Import messages from macOS Messages.app database.

**Syntax**:

```bash
chatline ingest-db [options]
```

**Options**:

| Flag                            | Type     | Default                          | Description                        |
| ------------------------------- | -------- | -------------------------------- | ---------------------------------- |
| `--db-path <path>`              | string   | `~/Library/Messages/chat.db`     | Path to chat.db                    |
| `--output <path>`               | string   | `ingested-db.json`               | Output JSON file                   |
| `--contact <identifier>`        | string   | _(optional)_                     | Filter by phone/email              |
| `--date-range <start:end>`      | string   | _(optional)_                     | Date range (YYYY-MM-DD:YYYY-MM-DD) |
| `--attachment-roots <paths...>` | string[] | `~/Library/Messages/Attachments` | Attachment directories             |

**Example**:

```bash
chatline ingest-db \
  --db-path ~/Library/Messages/chat.db \
  --output ./data/ingested-db.json \
  --contact "+61412345678" \
  --date-range 2024-01-01:2024-12-31
```

**Note**: Requires full disk access permission on macOS (System Preferences →
Security & Privacy → Privacy → Full Disk Access).

---

### 3. normalize-link

Deduplicate messages and link replies/tapbacks.

**Syntax**:

```bash
chatline normalize-link [options]
```

**Options**:

| Flag                 | Type    | Default           | Description                  |
| -------------------- | ------- | ----------------- | ---------------------------- |
| `--input <path>`     | string  | _(required)_      | Input JSON from ingest stage |
| `--output <path>`    | string  | `normalized.json` | Output JSON file             |
| `--merge-csv-db`     | boolean | `false`           | Merge CSV and DB sources     |
| `--csv-input <path>` | string  | _(optional)_      | CSV JSON (if merging)        |
| `--db-input <path>`  | string  | _(optional)_      | DB JSON (if merging)         |
| `--verbose`          | boolean | `false`           | Detailed logging             |

**Example (single source)**:

```bash
chatline normalize-link \
  --input ingested.json \
  --output normalized.json
```

**Example (merge CSV + DB)**:

```bash
chatline normalize-link \
  --merge-csv-db \
  --csv-input ingested-csv.json \
  --db-input ingested-db.json \
  --output normalized-merged.json \
  --verbose
```

**Output**: Normalized JSON with linked messages:

```json
{
  "messages": [
    {
      "guid": "abc-123",
      "messageKind": "text",
      "replies": ["def-456"],
      "text": "What do you think?",
      "threadTargetGuid": null
    },
    {
      "guid": "def-456",
      "messageKind": "text",
      "text": "Sounds great!",
      "threadTargetGuid": "abc-123"
    }
  ],
  "metadata": {
    "duplicatesRemoved": 6,
    "inputCount": 3104,
    "outputCount": 3098,
    "repliesLinked": 847,
    "source": "normalize-link",
    "tapbacksLinked": 234
  }
}
```

---

### 4. enrich-ai

Add AI-powered analysis to media messages.

**Syntax**:

```bash
chatline enrich-ai [options]
```

**Options**:

| Flag                        | Type    | Default           | Description                    |
| --------------------------- | ------- | ----------------- | ------------------------------ |
| `--input <path>`            | string  | _(required)_      | Normalized JSON                |
| `--output <path>`           | string  | `enriched.json`   | Output JSON                    |
| `--checkpoint-interval <n>` | number  | `100`             | Write checkpoint every N items |
| `--resume`                  | boolean | `false`           | Resume from last checkpoint    |
| `--force-refresh`           | boolean | `false`           | Re-enrich existing enrichments |
| `--rate-limit <ms>`         | number  | `1000`            | Delay between API calls (ms)   |
| `--max-retries <n>`         | number  | `3`               | Retry attempts for 5xx errors  |
| `--gemini-api-key <key>`    | string  | `$GEMINI_API_KEY` | Override API key               |
| `--enable-vision`           | boolean | `true`            | Enable image analysis          |
| `--enable-audio`            | boolean | `true`            | Enable transcription           |
| `--enable-links`            | boolean | `true`            | Enable link enrichment         |
| `--image-cache-dir <path>`  | string  | `./.cache/images` | Preview cache directory        |

**Example (standard run)**:

```bash
chatline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --checkpoint-interval 50 \
  --rate-limit 1500
```

**Example (resume after interruption)**:

```bash
chatline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --resume
```

**Example (disable certain enrichments)**:

```bash
chatline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --enable-audio false \
  --enable-links false
```

**Checkpoint Files**: Automatically created in
`./checkpoints/enrich-checkpoint-<index>.json`

**Resume behavior**: Continues from the last successfully enriched message.
Idempotency ensures no duplicate enrichments.

---

### 5. render-markdown

Generate Obsidian-compatible markdown timeline files.

**Syntax**:

```bash
chatline render-markdown [options]
```

**Options**:

| Flag                       | Type    | Default       | Description              |
| -------------------------- | ------- | ------------- | ------------------------ |
| `--input <path>`           | string  | _(required)_  | Enriched JSON            |
| `--output-dir <path>`      | string  | `./timeline`  | Output directory         |
| `--date-range <start:end>` | string  | _(all dates)_ | Filter by date range     |
| `--group-by-time`          | boolean | `true`        | Group by time-of-day     |
| `--nested-replies`         | boolean | `true`        | Render replies as nested |
| `--max-nesting-depth <n>`  | number  | `10`          | Max reply nesting levels |

**Example**:

```bash
chatline render-markdown \
  --input enriched.json \
  --output-dir ./timeline \
  --date-range 2024-10-01:2024-10-31
```

**Output Structure**:

```
timeline/
├── 2024-10-01.md
├── 2024-10-02.md
├── ...
└── 2024-10-31.md
```

**Sample Output** (`2024-10-15.md`):

```markdown
# 2024-10-15

## Morning (00:00 - 11:59)

### 08:23 - You

Good morning! ☀️

### 08:25 - Melanie

Morning! How'd you sleep?

> **You** (08:26): Really well, thanks! 😊

❤️ Melanie

## Afternoon (12:00 - 17:59)

### 14:30 - Melanie

Check out this photo!

![[IMG_1234.heic]]

> _Gemini Vision Analysis_: A beautiful sunset over the ocean with vibrant
> orange and pink hues reflecting on the water.

## Evening (18:00 - 23:59)

### 19:45 - You

Let's meet at this place: https://example.com/restaurant

> _Link Context_:
> **[Best Restaurant in Town - Example Dining](https://example.com/restaurant)**
> Award-winning restaurant featuring modern Australian cuisine with seasonal
> menus and waterfront views.
```

---

## Advanced Usage

### Batch Processing Multiple Contacts

```bash
#!/bin/bash
# process-all-contacts.sh

CONTACTS=(
  "+61412345678:melanie"
  "+61498765432:john"
  "alice@example.com:alice"
)

for contact_pair in "${CONTACTS[@]}"; do
  IFS=':' read -r contact name <<< "$contact_pair"

  echo "Processing $name ($contact)..."

  # Ingest from DB
  chatline ingest-db \
    --contact "$contact" \
    --output "data/${name}-ingested.json"

  # Normalize
  chatline normalize-link \
    --input "data/${name}-ingested.json" \
    --output "data/${name}-normalized.json"

  # Enrich
  chatline enrich-ai \
    --input "data/${name}-normalized.json" \
    --output "data/${name}-enriched.json" \
    --checkpoint-interval 50

  # Render
  chatline render-markdown \
    --input "data/${name}-enriched.json" \
    --output-dir "timeline/${name}"

  echo "✓ Completed $name"
done

echo "✓ All contacts processed"
```

### Incremental Updates (Daily Sync)

```bash
#!/bin/bash
# daily-sync.sh

DATE=$(date +%Y-%m-%d)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

# Export yesterday's messages only
chatline ingest-db \
  --date-range "$YESTERDAY:$DATE" \
  --output "data/daily-$DATE.json"

# Merge with existing normalized data
chatline normalize-link \
  --merge-csv-db \
  --csv-input "data/normalized-master.json" \
  --db-input "data/daily-$DATE.json" \
  --output "data/normalized-master.json"

# Enrich new messages only (idempotency handles duplicates)
chatline enrich-ai \
  --input "data/normalized-master.json" \
  --output "data/enriched-master.json"

# Render updated timeline
chatline render-markdown \
  --input "data/enriched-master.json" \
  --output-dir "./timeline" \
  --date-range "$YESTERDAY:$DATE"

echo "✓ Daily sync complete for $DATE"
```

### Custom Enrichment Providers

You can extend enrichment with custom providers:

```typescript
// custom-provider.ts
import type { MediaEnrichment } from '@nathanvale/chatline'

export async function enrichWithCustomAPI(
  mediaPath: string,
): Promise<MediaEnrichment> {
  const response = await fetch('https://your-api.com/analyze', {
    method: 'POST',
    body: JSON.stringify({ path: mediaPath }),
  })

  const data = await response.json()

  return {
    kind: 'custom_analysis',
    summary: data.summary,
    provider: 'custom-api',
    model: 'custom-v1',
    version: '1.0',
    createdAt: new Date().toISOString(),
  }
}
```

Then integrate in your workflow:

```typescript
import { renderMessages } from '@nathanvale/chatline'
import { enrichWithCustomAPI } from './custom-provider'

// Load normalized messages
const messages = JSON.parse(readFileSync('normalized.json', 'utf-8'))

// Apply custom enrichment
for (const msg of messages) {
  if (msg.messageKind === 'media' && msg.media?.mediaKind === 'image') {
    const enrichment = await enrichWithCustomAPI(msg.media.path)
    msg.media.enrichment = msg.media.enrichment || []
    msg.media.enrichment.push(enrichment)
  }
}

// Continue with standard render
const markdown = renderMessages(messages)
```

---

## Next Steps

- **Troubleshooting**: See
  [Troubleshooting Guide](./imessage-pipeline-troubleshooting.md)
- **API Reference**: See
  [Technical Specification](./imessage-pipeline-tech-spec.md)
- **Implementation Notes**: See
  [Refactor Report](./imessage-pipeline-refactor-report.md)

---

**Document Version**: 1.0 **Author**: Generated from iMessage Pipeline
implementation **Last Updated**: 2025-10-19
