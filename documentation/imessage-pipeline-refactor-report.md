# iMessage pipeline refactor report

> A comprehensive review and refactor plan to separate ingestion, normalization, AI enrichment, and markdown rendering for deterministic, resumable, and testable workflows.

## executive summary

You currently have three scripts:
- `.scripts/convert-csv-to-json.mjs` — Ingests legacy iMazing CSV and produces a detailed JSON with attachment resolution, tapback/reply parsing, and some linking logic
- `.scripts/export-imessages-json.mjs` — Exports new messages directly from the Messages.app SQLite DB into a comprehensive JSON format, including attachments and tapback metadata
- `.scripts/analyze-messages-json.mjs` — Processes a JSON export, enriches images/audio/links using external APIs, and also generates daily markdown

Key issues today:
- Responsibilities overlap and couple concerns (analysis + markdown rendering in a single tool)
- No single source of truth for the schema across scripts
- Linking, deduplication, and ID stability are not centralized
- Enrichment is tightly bound to rendering, making it harder to run independently and to resume

Refactor goal:
- Four clear stages: ingest → normalize/link → enrich (AI) → render (markdown)
- One unified, versioned JSON schema (with Zod validation and TypeScript types)
- Idempotent, checkpointable enrichment stage that only augments data
- Deterministic markdown rendering that consumes enriched JSON only

The plan below details the target architecture, unified schema, linking/dedup strategy, file layout, test/CI setup with Vitest, migration steps, and a rollout checklist.

---

## target architecture (four-stage pipeline)

```mermaid
flowchart LR
  A[Ingest: CSV] --> C[Normalize/Link]
  B[Ingest: DB]  --> C[Normalize/Link]
  C --> D[Enrich: AI]
  D --> E[Render: Markdown]

  subgraph inputs
    A
    B
  end

  subgraph processing
    C
    D
  end

  subgraph outputs
    E
  end
```

### stage 1 — ingest
- Tools
  - `ingest-csv` (refactor from `convert-csv-to-json.mjs`)
  - `ingest-db` (refactor from `export-imessages-json.mjs`)
- Output
  - Raw JSON artifacts with consistent base fields and minimal transformation
  - Do not perform cross-message linking or enrichment here
- Notes
  - Keep the media file path resolution you already built (it’s valuable and hard to reproduce later)
  - Normalize field names where possible but avoid introducing derived fields that depend on cross-message context

### stage 2 — normalize & link
- Tool: `normalize-link`
- Responsibilities
  - Merge multiple ingests (CSV and DB) into a single coherent dataset
  - Deduplicate messages across sources
  - Link replies and tapbacks deterministically
  - Compute stable, canonical IDs per message, per part
  - Enforce and validate schema via Zod
- Output
  - `messages.normalized.json` — The single source of truth for subsequent stages

### stage 3 — enrich (AI only)
- Tool: `enrich-ai`
- Responsibilities
  - Image analysis (Gemini Vision)
  - Audio transcription
  - Link context extraction (Firecrawl)
  - Append results to `message.media.enrichment`
  - Strict rate-limiting, retries, checkpointing, and resumability
  - Pure augmentation: must not alter core identifiers or linking state
- Output
  - `messages.enriched.json` — Preserves original data + adds `enrichment`

### stage 4 — render (markdown only)
- Tool: `render-markdown`
- Responsibilities
  - Convert enriched JSON to deterministic daily markdown
  - Zero network calls, zero enrichment logic
- Output
  - Daily markdown files under your chosen `outputDir`

---

## what the current analyzer already does well (to preserve)

Your existing `.scripts/analyze-messages-json.mjs` has a lot of thoughtful
features we want to keep as we split it into `enrich-ai` and
`render-markdown`:

- Audio transcription that is actually useful
  - Uses Gemini with a structured prompt that first classifies the audio
    (voice memo, conversation, music, ambient) and then transcribes with
    timestamps, speaker labels, and emotive cues
  - Returns a full transcription plus a concise short description
- Image analysis with smart preprocessing
  - Converts HEIC/TIFF/GIF to JPG via `sips` for analysis and also generates a
    JPG preview for Obsidian embedding
  - Produces a thorough description plus a short, scannable caption
- PDF analysis and pragmatic video handling
  - Summarizes PDFs with Gemini when enabled
  - Skips heavy video analysis by default for performance but still copies and
    surfaces the file
- Link context enrichment with resilient fallbacks
  - Firecrawl scraping to Markdown first, then a smart title extraction
  - Site-aware fallbacks: YouTube oEmbed or ID detection, Spotify/Facebook/
    Instagram heuristics, and a safe generic fallback
- MIME-driven item typing, not just extensions
  - Uses MIME to determine image/audio/video/pdf and pick the right enrichment
    path
- Reliable file handling and naming
  - Absolute paths are resolved up front; destination files use timestamped
    names sanitized for Obsidian
  - Verifies destination matches source by file size and re-copies on mismatch
  - Creates image previews for HEIC/TIFF and uses Obsidian wikilinks for
    embeds
- Checkpointing, progress, and resumability
  - Periodic checkpoints with partial enriched JSON and full descriptions,
    plus stats, ETA, average time per message, and a failed-items log
  - Flags for `--resume`, `--dry-run`, `--limit`, and `--clear-checkpoint`
- Sensible rate limiting and backoff points
  - Central `rateLimitedDelay` gate between API calls
  - Configurable delay, model, and retry ceiling
- Markdown output that reads like a conversation
  - Groups by Morning/Afternoon/Evening, sorts by timestamp, and adds message
    anchors for deep linking
  - Nests replies/tapbacks beneath the parent, renders tapbacks with emoji,
    and quotes voice memo transcriptions nicely
  - Displays link context below each URL in blockquotes
- Data hygiene that improves readability
  - Cleans message text and reply-to snippets, skips unsent markers, and
    normalizes whitespace/newlines
- Practical configuration ergonomics
  - JSON config supports env var expansion (e.g., `${GEMINI_API_KEY}`)
  - Feature toggles: `enableVisionAnalysis` (images/audio/PDFs) and
    `enableLinkAnalysis` (links)
  - Date filters (`startDate`, `endDate`) applied before enrichment

How this maps to the refactor:

- Move all networked enrichment (Gemini, Firecrawl) and media copying/preview
  generation into `enrich-ai`
- Keep Obsidian-friendly filenames, preview creation, and MIME-aware routing
  exactly as-is, with the same or stricter path invariants
- Preserve checkpoints and stats in `enrich-ai` (single checkpoint file,
  resumable runs, ETA and averages)
- Move all markdown-specific layout into `render-markdown` and keep the same
  presentation: time-of-day sections, anchors, nested replies/tapbacks,
  blockquoted link context and transcriptions
- Maintain feature toggles and environment expansion in a unified config, with
  renderer options separated from enrichment options

Net effect: you keep the transcription quality, image/PDF summaries, robust
link context, safe file handling, and readable markdown—just separated into
focused stages that are easier to test and resume.

---

## unified JSON schema (TypeScript + Zod)

Single source of truth for the data model. Typescript provides developer ergonomics; Zod provides runtime validation and safe parsing.

Important domain adjustment per requirements:
- There is no separate Attachment entity. Media is a standalone message that can receive replies and tapbacks just like text.
- Therefore, a message can be one of: text, media, tapback, notification.
- Media messages carry their own media metadata and enrichment.

```ts
// src/schema/message.ts
import { z } from 'zod'

export type MessageGUID = string
export type ChatId = string

export interface TapbackInfo {
  type: 'loved' | 'liked' | 'disliked' | 'laughed' | 'emphasized' | 'questioned' | 'emoji'
  action: 'added' | 'removed'
  targetMessageGuid?: MessageGUID
  targetMessagePart?: number
  targetText?: string
  isMedia?: boolean
  emoji?: string
}

export interface ReplyInfo {
  sender?: string
  date?: string // ISO 8601
  text?: string
  targetMessageGuid?: MessageGUID
}

export type MediaKind = 'image' | 'audio' | 'video' | 'pdf' | 'unknown'

export interface MediaEnrichment {
  kind: MediaKind | 'link'
  model?: string
  createdAt: string
  // image
  visionSummary?: string
  shortDescription?: string
  // audio
  transcript?: string
  // link
  url?: string
  title?: string
  summary?: string
  // provenance
  provider: 'gemini' | 'firecrawl' | 'local'
  version: string
}

export interface MediaMeta {
  // Represents the single media item carried by a media message
  id: string
  filename: string
  path: string
  size?: number
  mimeType?: string
  uti?: string | null
  isSticker?: boolean
  hidden?: boolean
  mediaKind?: MediaKind
  enrichment?: Array<MediaEnrichment>
}

export interface MessageCore {
  guid: MessageGUID
  rowid?: number
  chatId?: ChatId | null
  service?: string | null
  subject?: string | null
  handleId?: number | null
  handle?: string | null
  destinationCallerId?: string | null
  isFromMe: boolean
  otherHandle?: number | null
  date: string // ISO 8601
  dateRead?: string | null
  dateDelivered?: string | null
  dateEdited?: string | null
  isRead?: boolean
  itemType?: number
  groupActionType?: number
  groupTitle?: string | null
  shareStatus?: boolean
  shareDirection?: boolean | null
  expressiveSendStyleId?: string | null
  balloonBundleId?: string | null
  threadOriginatorGuid?: string | null
  threadOriginatorPart?: number | null
  numReplies?: number
  deletedFrom?: number | null
}

export interface Message extends MessageCore {
  messageKind: 'text' | 'media' | 'tapback' | 'notification'
  text?: string | null
  tapback?: TapbackInfo | null
  replyingTo?: ReplyInfo | null
  replyingToRaw?: string | null
  // Media is modeled as a message; when messageKind = 'media', this is required
  media?: MediaMeta | null
  groupGuid?: string | null
  exportTimestamp?: string
  exportVersion?: string
  isUnsent?: boolean
  isEdited?: boolean
}

export interface ExportEnvelope {
  schemaVersion: string
  source: 'csv' | 'db' | 'merged'
  createdAt: string
  messages: Array<Message>
  meta?: Record<string, unknown>
}

// Zod schemas ensure runtime correctness and cross-field invariants
export const TapbackInfoSchema = z.object({
  type: z.enum(['loved', 'liked', 'disliked', 'laughed', 'emphasized', 'questioned', 'emoji']),
  action: z.enum(['added', 'removed']),
  targetMessageGuid: z.string().optional(),
  targetMessagePart: z.number().int().optional(),
  targetText: z.string().optional(),
  isMedia: z.boolean().optional(),
  emoji: z.string().optional(),
})

export const ReplyInfoSchema = z.object({
  sender: z.string().optional(),
  date: z.string().datetime().optional(),
  text: z.string().optional(),
  targetMessageGuid: z.string().optional(),
})

export const AttachmentEnrichmentSchema = z.object({
  kind: z.enum(['image', 'audio', 'link', 'video', 'pdf']),
  model: z.string().optional(),
  createdAt: z.string().datetime(),
  visionSummary: z.string().optional(),
  shortDescription: z.string().optional(),
  transcript: z.string().optional(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  provider: z.enum(['gemini', 'firecrawl', 'local']),
  version: z.string(),
})

export const MediaEnrichmentSchema = AttachmentEnrichmentSchema

export const MediaMetaSchema = z.object({
  id: z.string(),
  filename: z.string(),
  path: z.string(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  uti: z.string().nullable().optional(),
  isSticker: z.boolean().optional(),
  hidden: z.boolean().optional(),
  mediaKind: z.enum(['image', 'audio', 'video', 'pdf', 'unknown']).optional(),
  enrichment: z.array(MediaEnrichmentSchema).optional(),
})

export const MessageCoreSchema = z.object({
  guid: z.string(),
  rowid: z.number().optional(),
  chatId: z.string().nullable().optional(),
  service: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  handleId: z.number().nullable().optional(),
  handle: z.string().nullable().optional(),
  destinationCallerId: z.string().nullable().optional(),
  isFromMe: z.boolean(),
  otherHandle: z.number().nullable().optional(),
  date: z.string().datetime(),
  dateRead: z.string().datetime().nullable().optional(),
  dateDelivered: z.string().datetime().nullable().optional(),
  dateEdited: z.string().datetime().nullable().optional(),
  isRead: z.boolean().optional(),
  itemType: z.number().optional(),
  groupActionType: z.number().optional(),
  groupTitle: z.string().nullable().optional(),
  shareStatus: z.boolean().optional(),
  shareDirection: z.boolean().nullable().optional(),
  expressiveSendStyleId: z.string().nullable().optional(),
  balloonBundleId: z.string().nullable().optional(),
  threadOriginatorGuid: z.string().nullable().optional(),
  threadOriginatorPart: z.number().nullable().optional(),
  numReplies: z.number().optional(),
  deletedFrom: z.number().nullable().optional(),
})

export const MessageSchema = MessageCoreSchema.extend({
  messageKind: z.enum(['text', 'media', 'tapback', 'notification']),
  text: z.string().nullable().optional(),
  tapback: TapbackInfoSchema.nullable().optional(),
  replyingTo: ReplyInfoSchema.nullable().optional(),
  replyingToRaw: z.string().nullable().optional(),
  media: MediaMetaSchema.nullable().optional(),
  groupGuid: z.string().nullable().optional(),
  exportTimestamp: z.string().datetime().optional(),
  exportVersion: z.string().optional(),
  isUnsent: z.boolean().optional(),
  isEdited: z.boolean().optional(),
}).superRefine((msg, ctx) => {
  // Invariants across fields
  if (msg.messageKind === 'tapback' && !msg.tapback) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tapback kind requires tapback payload' })
  }
  if (msg.messageKind === 'media' && !msg.media) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'media kind requires media payload' })
  }
  if (msg.messageKind !== 'media' && msg.media) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'media payload present on non-media message' })
  }
  if (msg.replyingTo?.date && isNaN(Date.parse(msg.replyingTo.date))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'replyingTo.date must be ISO 8601' })
  }
})

export const ExportEnvelopeSchema = z.object({
  schemaVersion: z.string(),
  source: z.enum(['csv', 'db', 'merged']),
  createdAt: z.string().datetime(),
  messages: z.array(MessageSchema),
  meta: z.record(z.any()).optional(),
})
```

### schema notes
- Use `Array<T>` in types to maintain clarity
- `superRefine` centralizes cross-field invariants and error messages
- Media is modeled as a message; keep enrichment under `message.media.enrichment`
- Version the `schemaVersion` and `exportVersion` so you can orchestrate migrations predictably

---

## CSV output compatibility & mapping

Your CSV → JSON converter already splits rows into multiple messages per moment and models a single media item as its own message with `message_kind = 'media'`. That aligns well with the new "media as message" model. Below is the minimal mapping from the current CSV JSON into the unified schema:

- kind and core fields
  - `message_kind` → `messageKind`
  - `text` → `text`
  - `service` (lowercased) → `service`
  - `is_from_me` → `isFromMe`
  - `date`, `date_read`, `date_delivered`, `date_edited` → `date`, `dateRead`, `dateDelivered`, `dateEdited`
  - `chat_id` → `chatId`
  - `group_guid` → `groupGuid`
  - `subject` → `subject`
  - `is_unsent` → `isUnsent`
  - `is_edited` → `isEdited`

- media (attachments → single media)
  - `attachments[0]` (when `message_kind = 'media'`) → `media`
    - `attachments[0].copied_path` → `media.path`
    - `attachments[0].filename` → `media.filename`
    - `attachments[0].mime_type` → `media.mimeType`
    - `attachments[0].uti` → `media.uti`
    - `attachments[0].total_bytes` → `media.size`
  - `attachment_type` → infer `media.mediaKind` from MIME (image/audio/video/pdf/unknown)
  - If CSV marks missing files (`attachment_missing`): set `media.path` to null and retain filename; optionally store a `mediaMissing: true` flag in an extension field if desired

- replies and tapbacks
  - `replying_to` (parsed object) → `replyingTo` with `sender`, `date`, `text`
  - Linking pass sets `associated_message_guid` → map to:
    - `replyingTo.targetMessageGuid` for reply messages
    - `tapback.targetMessageGuid` for reaction messages
  - `tapback` payload (type/action/emoji/target_text) → `tapback` with equivalent fields; note `target_text` becomes `targetText`

- fields to keep as meta or drop
  - `message_type` (Incoming/Outgoing/Notification): redundant with `isFromMe` and `messageKind`; keep only if helpful for analytics
  - `status`, `is_read`, `is_delivered`: retain booleans; raw `status` string can move to `meta` if needed
  - `num_attachments`, `timestamp_index`: optional debug/ordering helpers; can be placed under a `meta.sequenceIndex`
  - `sender_name`: CSV-only label; recommend adding optional `senderName?: string | null` if you want to preserve it explicitly (else map into `handle` fallback)

Net result: No semantic drift. The only structural change is collapsing `attachments[0]` into `media` and camelCasing field names. Linking info moves from a top-level `associated_message_guid` to the appropriate nested field within `replyingTo` or `tapback`.

If you’d like, we can include `senderName?: string | null` and `mediaMissing?: boolean` in the schema as optional fields. Otherwise, both can be handled in the normalize stage as metadata.

---

## DB exporter drift & mapping

The DB exporter currently emits one message per DB row with an `attachments` array and no `message_kind`. To align with the CSV output and the unified schema (media as standalone messages), apply the following:

### current shape (db)
- One message object with:
  - `text` (possibly null)
  - `attachments: Array<{ filename, mime_type, uti, total_bytes, copied_path, ... }>`
  - `num_attachments`
  - tapback fields: `associated_message_guid`, `associated_message_type`, `associated_message_emoji`, and `tapback`
  - no `message_kind`

### desired shape (aligned)
- Split each DB row into multiple message objects:
  - Text message if `text` exists → `messageKind = 'text'`
  - For each attachment → a separate media message with `messageKind = 'media'` and a single `media` payload
  - Tapback message when `associated_message_type` ∈ 2000–3006 → `messageKind = 'tapback'`

### grouping and guids
- Use the DB `guid` as the shared `groupGuid` for all parts from a single DB row
- Assign part GUIDs to support precise linking:
  - Text part: `guid = p:0/<DB guid>`
  - First media: `guid = p:1/<DB guid>`; next media: `p:2/<DB guid>`, etc.
  - This mirrors the DB’s own convention in `associated_message_guid`

### field mappings (db → unified schema)
- core and naming
  - add `messageKind` per part
  - camelCase: `is_from_me` → `isFromMe`, `date_read` → `dateRead`, etc.
  - `chat_id` → `chatId`, `group_title` → `groupTitle`
  - `export_timestamp` → `exportTimestamp`, `export_version` → `exportVersion`

- media
  - For each `attachments[i]` → `media` object on a media message:
    - `media.path` ← `attachments[i].copied_path`
    - `media.filename` ← `attachments[i].filename`
    - `media.mimeType` ← `attachments[i].mime_type`
    - `media.uti` ← `attachments[i].uti`
    - `media.size` ← `attachments[i].total_bytes`
    - `media.mediaKind` inferred from `media.mimeType`
    - `media.id` = stable hash of `{path|filename+size}` (fallback to attachment rowid)

- replies and tapbacks
  - If `thread_originator_guid` present: set `replyingTo.targetMessageGuid`
  - If `tapback` present: set `tapback` fields and `tapback.targetMessageGuid` from `associated_message_guid`
  - Normalize stage will point to the correct part GUID

### algorithm (db split)
1) Per DB row, produce 0–1 text message, N media messages, 0–1 tapback message
2) Use `groupGuid = <DB guid>` and part GUIDs as `p:<index>/<DB guid>`
3) Carry `date`, `isFromMe`, and other core fields onto all parts
4) Defer linking to normalize stage

This change aligns DB output with CSV output and the unified schema, enabling consistent downstream enrichment and rendering.

---

## linking & deduplication strategy

### identifiers
- DB messages already have stable `guid`
- CSV messages need synthetic canonical IDs
  - Recommend `guid = csv:<rowid>:<partIndex>` to match your current part-splitting logic
  - Preserve original CSV row index as `rowid`

### deduplication
- Primary key: `guid` when present
- For CSV-only or pre-guid data, use a deterministic fingerprint:
  - Hash of `{chatSession|chatId, senderId|handle, isoDateSecond, normalizedText, partIndex}`
  - If attachments exist without text, include `{attachment.filename, size}` in the fingerprint
- When merging CSV + DB data, prefer DB record as authoritative and mark CSV record as merged

### reply linking
- Build indices by `guid` and by timestamp (second resolution)
- For reply messages with a reference date:
  - Exact timestamp bucket → candidates
  - Expand ±5 minutes when necessary
  - Filter by sender if present
  - Prefer same `groupGuid`/moment when collisions occur
  - Rank by snippet overlap for text replies; for media replies, prefer candidates with `messageKind = 'media'`
  - On tie, choose nearest prior message in same moment

### tapback linking
- For reaction messages, look back up to 5 minutes
- Filter out non-target kinds (ignore tapbacks/notifications in candidates)
- Prefer exact `associated_message_guid` if known (DB)
- Rank by text snippet overlap or image/media presence for media reactions
- Fallback to nearest prior message in same `groupGuid`

### reply threading parity (CSV ↔ DB)
Reuse the exact CSV heuristic for both sources to ensure identical behavior:

- indices
  - Build `byGuid` and `byTimestamp` (second-resolution buckets)
  - Sort candidates first by exact timestamp match; expand to a ±5 minute window if needed

- candidate filters
  - Same sender (when `replyingTo.sender` is known)
  - Same `groupGuid` (same “moment”) when available

- scoring (as implemented in CSV tool)
  - Text replies
    - candidate.text startsWith(snippet): +100
    - candidate.text includes(snippet): +50
  - Media-implied replies (no snippet or mentions image/photo):
    - candidate.message_kind === 'media': +80
    - Prefer lower `timestamp_index` (earlier part in the moment): +(10 - timestamp_index)
  - Timestamp proximity
    - exact second match: +20
    - otherwise: subtract absolute time delta (seconds)
  - Choose highest score; on tie, fallback to nearest prior in same `groupGuid`

- DB alignment
  - Primary: use `associated_message_guid` from DB when present to set `replyingTo.targetMessageGuid` (points to `p:<index>/<guid>` after split)
  - Fallback: apply the same scoring heuristic above when the association isn’t available or resolvable
  - Ensure DB split emits part GUIDs (`p:0/<guid>`, `p:1/<guid>`, …) so associations resolve to the correct part

### media normalization
- Ensure `media.path` is an absolute full path (not relative)
- Normalize `mimeType` and compute `mediaKind` from `mimeType`
- Compute `media.id` = stable hash of `{path|filename+size}`
- Optionally de-duplicate identical media across messages if your data model ever reuses files

---

## performance, resilience, and resumability

- Enrichment is the slow stage; treat it as a pure augmentation job
- Rate limiting: reuse your `rateLimitedDelay` and extend with exponential backoff on 429/5xx
- Concurrency: cap to a small thread pool (1–2) to avoid API throttling
- Checkpointing: keep a single `.checkpoint.json` with
  - lastProcessedIndex
  - stats (counts, images, audio, links, errors)
  - partial `enrichedMessages` and `fullDescriptions`
- Idempotency: enrichment results are keyed by `media.id` and `kind`; skip if already present
- Integrity: write via temp files and atomic rename to avoid corruption

---

## file layout & tooling

Proposed minimal layout while keeping your existing `.scripts` folder:

```
.scripts/
  pipeline/
    ingest-csv.mts            # refactor from convert-csv-to-json
    ingest-db.mts             # refactor from export-imessages-json
    normalize-link.mts        # merge, dedup, link replies/tapbacks
    enrich-ai.mts             # AI-only enrichment (Gemini, Firecrawl)
    render-markdown.mts       # markdown only
  schema/
    message.ts                # types + zod schemas
  config/
    pipeline.config.json      # shared config
```

- Use `.mts` for TS ESM scripts run via `tsx` or `ts-node`
- Keep your `message-analyzer-config.json` shape, but separate renderer options (paths, formatting) from enrichment options (models, rate limits)
- Add a small `src/lib/` with shared utilities (date, MIME, hashing)

### package.json scripts (pnpm)

```jsonc
{
  "scripts": {
    "pipeline:ingest:csv": "tsx ./.scripts/pipeline/ingest-csv.mts -c ./.scripts/config/pipeline.config.json",
    "pipeline:ingest:db": "tsx ./.scripts/pipeline/ingest-db.mts -c ./.scripts/config/pipeline.config.json",
    "pipeline:normalize": "tsx ./.scripts/pipeline/normalize-link.mts -c ./.scripts/config/pipeline.config.json",
    "pipeline:enrich": "tsx ./.scripts/pipeline/enrich-ai.mts -c ./.scripts/config/pipeline.config.json",
    "pipeline:render": "tsx ./.scripts/pipeline/render-markdown.mts -c ./.scripts/config/pipeline.config.json"
  }
}
```

---

## security & privacy

- API keys only via env and not persisted in checkpoint files
- Provide a `--redact` option to mask PII before writing markdown
- Local-only mode: allow disabling external calls (skip enrichment, render raw)
- Maintain a `provenance` block on enrichment payloads with model, version, and timestamp

---

## dates & timezones

Consistent timestamps are essential for deterministic linking and ordering.

### CSV source
- iMazing CSV timestamps are UTC; the converter appends `Z` and uses `new Date(<YYYY-MM-DDTHH:mm:ss>Z).toISOString()`
- This yields ISO 8601 strings with `Z` (UTC) and is safe for cross-platform parsing
- Keep as-is. Treat CSV as authoritative UTC for its timestamps

### DB source
- Apple stores nanoseconds since 2001-01-01 00:00:00 UTC (Apple epoch)
- Current code converts via: `unix = apple_ns / 1e9 + APPLE_EPOCH_SECONDS` then `.toISOString()`
- This produces ISO 8601 UTC strings (with `Z`)—which matches the CSV

### invariants and validation
- All date-like fields in the unified schema must be ISO 8601 with `Z` or offset
  - Enforced in Zod using `z.string().datetime()`
- Fields: `date`, `dateRead`, `dateDelivered`, `dateEdited`, `exportTimestamp`, and any nested times in enrichment must be valid ISO
- When ingesting CSV, ensure `convertToISO8601` normalizes reliably and logs any parse errors
- When ingesting DB, normalize through the Apple epoch converter; avoid locale-dependent formatting

### ordering and grouping
- Sort by `date` (ms precision) and then stable part index when splitting a single moment
- Linking by timestamp should round to seconds for bucket lookup but maintain ms precision in storage

### display vs storage
- Storage: always UTC ISO 8601
- Display in markdown: localize at render time only (e.g., using `toLocaleTimeString`)

Outcome: CSV and DB agree on UTC ISO timestamps with `Z`; linking and enrichment operate on a single, consistent notion of time.

---

## media path resolution & provenance

Final JSON must carry absolute paths to media files because files can originate from multiple sources (macOS Messages attachments directory vs iMazing backup directory). Store both a display name and the absolute path:

- `media.filename`: the display/original filename
- `media.path`: absolute full path to the file on disk
- Optional: `media.provenance?: 'db' | 'imazing'` to capture source; `version?: string` if desired

### CSV resolver (iMazing backups)
- Strategy implemented in CSV converter:
  - Skip `.pluginPayloadAttachment`
  - For bare filenames, build an exact timestamp prefix using the message date in UTC: `YYYY-MM-DD HH MM SS`
  - Match files in the configured attachments directory with pattern:
    - `"<timestamp> - <Sender Name> - <originalfilename.ext>"`
    - Choose first exact match; if none, mark as missing and still emit a media message (filename retained, path null)
  - For DB-style absolute paths in CSV, expand `~` and validate existence
- Action: Document this filename pattern and keep it stable; log misses explicitly

### DB resolver (Messages attachments)
- Strategy implemented in DB exporter:
  - Preferred: search iMazing-style date-prefixed files when `transfer_name` and message date are known
  - Fallbacks:
    - Use `filename` if absolute
    - Expand `~`
    - Join the last 4 components under the configured `attachmentBasePath`
    - Use `transfer_name` under `attachmentBasePath`
- In practice, DB attachment resolution is usually simpler because the database paths or transfer names map directly to the Messages attachments hierarchy

### policy & validation
- Always write `media.path` as an absolute path; retain `media.filename` for human readability
- Use `media.id` derived from `{path|filename+size}` to remain stable across sources
- Optional: set `media.provenance` = 'imazing' for CSV-derived files, 'db' for DB-derived files
- In validation: assert `media.path` is absolute when present; allow null only for missing files captured intentionally by the CSV resolver

---

## testing & CI (Vitest)

- Use Vitest with `threads` pool capped at 8, `allowOnly: false`
- Place tests under `__tests__/` with `.test.ts` suffix
- Use `environment: 'node'` for CLI units; `jsdom` for any DOM-specific rendering helpers
- Mock external services with `vi.mock()`; reset via `vi.resetAllMocks()` in `beforeEach`
- Coverage: V8 coverage via `@vitest/coverage`, thresholds ≥ 70%
- CI reporters: junit to `./test-results/junit.xml` and coverage to `./test-results/coverage/`

Example: enrichment unit tests

```ts
import { describe, it, beforeEach, expect, vi } from 'vitest'
import { enrichAttachment } from '#lib/enrich'

vi.mock('@google/generative-ai', () => ({ /* stub genAI */ }))
vi.mock('@mendable/firecrawl-js', () => ({ /* stub Firecrawl */ }))

describe('enrichAttachment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('adds a vision summary for images', async () => {
    const att = { id: 'a1', path: '/tmp/photo.jpg', filename: 'photo.jpg', mimeType: 'image/jpeg' }
    const out = await enrichAttachment(att, { enableVisionAnalysis: true })
    expect(out.enrichment?.[0]?.kind).toBe('image')
    expect(out.enrichment?.[0]?.visionSummary).toBeDefined()
  })
})
```

---

## migration plan

1) Introduce schema
- Add `src/schema/message.ts` with TypeScript + Zod
- Validate current outputs from both ingesters; adapt fields to match the schema

2) Split analysis and rendering
- Extract markdown generation from `.scripts/analyze-messages-json.mjs` into `render-markdown.mts`
- Keep enrichment-only logic in `enrich-ai.mts`

3) Centralize linking & dedup
- Create `normalize-link.mts` that consumes the CSV and DB outputs and emits a single `messages.normalized.json`

4) Idempotent enrichment
- Implement media-level enrichment keyed by `media.id`
- Add checkpoint + resume using a single checkpoint file

5) Render deterministic markdown
- Consume `messages.enriched.json` only
- No network calls, no enrichment logic

6) Backfill & verify
- Run the whole pipeline on a known slice
- Compare markdown diffs between old and new to ensure parity
- Reconcile any intentional format changes

7) Validate dates end-to-end
- Add a small validator script that loads CSV and DB artifacts and asserts:
  - All message dates are ISO 8601 with `Z`
  - DB Apple-epoch conversion produces stable UTC timestamps matching CSV alignment
  - Sorting by `date` and part-index yields deterministic order

8) Cutover
- Replace old scripts with new pipeline commands in `package.json`
- Archive legacy scripts and document the migration

---

## risks & mitigations

- API rate limits → strict concurrency caps, retries, and exponential backoff
- Data drift between CSV and DB → deterministic dedup rules and prefer DB as truth when GUID exists
- Breaking schema changes → version the schema and exportVersion; provide migration notes
- Large datasets → streaming writes and per-day chunked rendering; consider splitting enriched JSON per month if necessary

---

## timeline (suggested)

- Day 1–2: Land schema + validation; adapt CSV/DB ingesters to schema
- Day 3: Build normalize-link stage and stabilize linking/dedup
- Day 4–5: Extract enrichment + checkpointing; separate renderer; parity test on sample
- Day 6: Wire Vitest + coverage + CI reporters; add minimal tests
- Day 7: Backfill historical data; finalize docs and cutover

---

## appendix A — example JSON (enriched)

```json
{
  "schemaVersion": "2.0.0",
  "source": "merged",
  "createdAt": "2025-10-17T03:30:00.000Z",
  "messages": [
    {
      "guid": "DB:XYZ-123",
      "messageKind": "media",
      "text": null,
      "isFromMe": false,
      "date": "2023-10-23T06:52:57.000Z",
      "media": {
        "id": "media:sha1:...",
        "filename": "IMG_2199.jpeg",
        "path": "/abs/path/IMG_2199.jpeg",
        "mimeType": "image/jpeg",
        "mediaKind": "image",
        "enrichment": [
          {
            "kind": "image",
            "provider": "gemini",
            "model": "gemini-1.5-pro",
            "version": "2025-10-17",
            "createdAt": "2025-10-17T03:31:00.000Z",
            "visionSummary": "Two people brunching outdoors...",
            "shortDescription": "Outdoor brunch photo"
          }
        ]
      }
    }
  ]
}
```

---

## appendix B — CLI surface (proposed)

- `pnpm pipeline:ingest:csv -i <csv> -o raw.csv.json`
- `pnpm pipeline:ingest:db -c <config> -o raw.db.json`
- `pnpm pipeline:normalize -i raw.csv.json -i raw.db.json -o messages.normalized.json`
- `pnpm pipeline:enrich -i messages.normalized.json -o messages.enriched.json --resume`
- `pnpm pipeline:render -i messages.enriched.json -o ./02_Areas/.../` 

Each step validates its inputs against Zod and writes versioned outputs.

---

## completion summary

- Proposed a clean four-stage pipeline that separates concerns
- Defined a unified schema with TypeScript types and Zod validators (`superRefine` for invariants)
- Specified deterministic linking and deduplication rules
- Outlined resiliency measures (rate limits, checkpoints, idempotency)
- Provided test/CI guidance using Vitest
- Detailed a migration plan and timeline

Open to iterate on the schema and file layout once you decide where you want the new `src/` or `.scripts/pipeline` to live.

---

## appendix C — CSV converter deep-dive: domains, gaps, improvements

A focused audit of `.scripts/convert-csv-to-json.mjs` to ensure coverage across message domains and alignment with the unified schema.

### domains covered well today
- Message splitting per CSV row into multiple messages by “moment”
  - text message for body text
  - media message when an attachment is present
  - separate tapback and notification messages
- UTC handling for dates with `.toISOString()` and `Z` suffix
- Reply parsing from “➜ Replying to … « … »” into structured object
- Tapback detection with smart-quote patterns and emoji reactions
- iMazing attachment resolution via timestamped filename pattern
- Deterministic sort by date then `timestamp_index`
- Linking pass for replies and tapbacks using timestamp buckets

### notable gaps or risks
- chat_id is hard-coded to `62`
  - risk: implies a fixed chat that may not correspond to reality
  - recommendation: set `chatId: null` in CSV ingest; let normalize-link infer or map if desired, or keep `chat_session` as human label only

- reply linking window collects only the first non-empty second
  - current logic: in `resolveReplyTarget`, the ±5 minute search breaks on the first second that has candidates and does not aggregate all candidates across the window
  - risk: could miss a better-scoring candidate that occurs a few seconds later
  - recommendation: mirror the tapback approach and aggregate all candidates across the whole window before scoring

- tapback removal patterns are incomplete
  - supported removal: only “Removed a heart from …”
  - missing: removal for liked, disliked, laughed, emphasized, questioned
  - recommendation: add analogous “Removed a like from …”, “Removed a laugh from …”, etc., and add media variants like “Removed a like from an image” when applicable

- limited media phrases
  - supported: “Loved an image”, “Liked an image”, “Emphasized an image”, “Laughed at an image”
  - possibly missing: “Loved a photo”, “Liked a video”, “Laughed at a video”, “Emphasized a photo”
  - recommendation: extend pattern synonyms to cover photo/image/video variations

- associated_message_* fields
  - CSV sets `associated_message_guid` only during linking pass on the message object
  - schema alignment: we will move these into `replyingTo.targetMessageGuid` and `tapback.targetMessageGuid` during normalize-link

- media provenance & absolute paths
  - converter returns `attachments[0].copied_path`; we will map to `media.path`
  - recommendation: ensure path is absolute and set `media.provenance = 'imazing'` in normalize

- item_type semantics and status string
  - CSV sets `item_type: isUnsent ? 1 : 0` and leaves `status` as a string; booleans for delivered/read are inferred
  - recommendation: treat `itemType` as optional metadata; keep `isRead` and `isDelivered` as canonical booleans; place raw `status` in meta if needed

### parity requirements for DB path
- Use the same reply heuristic and scoring rules as CSV (now documented)
- Ensure DB split emits `p:<index>/<guid>` part GUIDs so tapbacks and replies can resolve to the precise part
- Prefer DB’s `associated_message_guid` for linking; fallback to heuristic when absent
- Use absolute media paths and set `media.provenance = 'db'`

### low-risk enhancements
- Add optional `senderName?: string | null` to schema if you want to preserve the CSV sender label
- Add a `mediaMissing?: boolean` marker when the iMazing resolver can’t find a file
- Improve emoji reaction parsing to handle alternate quote styles beyond smart quotes when encountered

These items are either addressed in the normalize-link stage or documented for targeted improvements to the CSV converter while preserving its proven behavior.
