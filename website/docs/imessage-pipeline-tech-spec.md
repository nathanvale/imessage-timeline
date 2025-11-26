# iMessage pipeline — technical specification

> Detailed specification to implement the four-stage pipeline with a unified
> schema, enrichment, and deterministic rendering. Includes task breakdown,
> acceptance criteria, and risks.

## 1. scope & goals

- Build a reliable, testable pipeline:
  - ingest → normalize/link → enrich (AI) → render (markdown)
- Unify schema with media-as-message (no attachments array)
- Preserve analyzer strengths: transcription quality, image/PDF summaries, link
  context, previews, checkpoints, and readable markdown
- Produce deterministic outputs that can be validated and reproduced

### non-goals

- Replacing upstream export tools (iMazing, Messages DB)
- Full video transcription or heavy video processing
- Online publishing; outputs are local JSON + Markdown files

## 2. architecture overview

- Refer to `documentation/imessage-pipeline-refactor-report.md` for the full
  narrative and diagrams.
- Four-stage pipeline with strict separation of concerns:
  1. ingest (CSV/DB) → raw JSON
  2. normalize-link → merge, dedup, link replies/tapbacks, validate
  3. enrich-ai → AI-only augmentation, idempotent and resumable
  4. render-markdown → deterministic daily markdown, no network calls

## 3. data model & invariants

- Single `Message` model with
  `messageKind ∈ {'text','media','tapback','notification'}`
- Media is a standalone message with a single `media` payload
- Timestamps are ISO 8601 UTC with `Z`
- DB rows may be split into parts with stable part GUIDs `p:<index>/<guid>`
- Linking uses canonical GUIDs and heuristics (see report)

### schema

- Implement with TypeScript interfaces and Zod validators
- Use `superRefine` for cross-field invariants
- Enrichment is stored under `message.media.enrichment: Array<MediaEnrichment>`
- See report for the full schema block (copy to `src/schema/message.ts`)

### key invariants

- If `messageKind = 'media'` → `media` exists and is complete
- If `messageKind = 'tapback'` → `tapback` exists
- Non-media messages must not carry a `media` payload
- All dates are ISO 8601 with `Z`
- `media.path` must be absolute when available; missing files retain filename

## 4. components & CLIs

### 4.1 ingest-csv

- Input: iMazing CSV export + attachments dir
- Output: `messages.csv.ingested.json`
- Responsibilities:
  - Parse rows, split into text/media/tapback/notification
  - Resolve media paths (iMazing pattern) to absolute paths when possible
  - Emit minimal linking info; do not perform cross-row linking

### 4.2 ingest-db

- Input: Messages.app SQLite DB + attachments roots
- Output: `messages.db.ingested.json`
- Responsibilities:
  - Extract messages, attachments, tapback hints
  - Do not split rows; keep attachments at this stage or split minimally
  - Preserve row metadata for later splitting

### 4.3 normalize-link

- Input: one or both ingests
- Output: `messages.normalized.json`
- Responsibilities:
  - Merge sources, dedup by GUID + content equivalence
  - Split DB rows into parts with `messageKind` per part
  - Assign part GUIDs `p:<index>/<guid>` for media and tapbacks
  - Link replies/tapbacks (DB association first, then heuristics)
  - Enforce schema via Zod; fix camelCase and standardize fields
  - Validate date correctness and path absolutes

### 4.4 enrich-ai

- Input: `messages.normalized.json`
- Output: `messages.enriched.json` + per-run checkpoint + optional
  `messages.full-descriptions.json`
- Responsibilities:
  - Image analysis (HEIC/TIFF→JPG preview + Gemini caption/summary)
  - Audio transcription with structured prompt and short description
  - PDF summarization; video copied with note, no heavy analysis by default
  - Link context via Firecrawl; resilient fallbacks (YouTube/Spotify/etc.)
  - Idempotent enrichment keyed by `media.id` + `kind`
  - Checkpointing, rate limits, retries; resumable execution

### 4.5 render-markdown

- Input: `messages.enriched.json`
- Output: per-day Markdown files under `outputDir`
- Responsibilities:
  - Group by date and time-of-day (Morning/Afternoon/Evening)
  - Message anchors for deep links; nested replies/tapbacks
  - Obsidian-friendly embeds for images (use preview for HEIC/TIFF)
  - Quote transcriptions and link contexts as blockquotes
  - Strictly deterministic; no network calls

## 5. configuration

- Central `./.scripts/config/pipeline.config.json` with:
  - Ingest paths, attachments roots
  - Normalize-link toggles (heuristics, thresholds)
  - Enrich toggles: `enableVisionAnalysis`, `enableLinkAnalysis`, `geminiModel`,
    `rateLimitDelay`, `checkpointInterval`, `maxRetries`
  - Render options: output dir, naming, sectioning
- Env var expansion supported using `${VAR}` syntax
- API keys only from env; never persisted to artifacts/checkpoints

## 6. logging, errors, resiliency

- Structured log lines with type, target, and result
- Centralized retry/backoff for 429/5xx with jitter; respect `rateLimitDelay`
- Checkpoint schema: last index, partial outputs, stats, failed items
- On resume, verify config consistency before continuing

## 7. security & privacy

- Local-only mode (skip enrichment calls)
- Redaction hooks (optional) before writing enriched JSON/Markdown
- Avoid persisting API keys; scrub logs of sensitive content
- Provenance on enrichment entries: provider, model, version, timestamp

## 8. performance

- Concurrency caps tuned by provider rate limits
- Batch writes with atomic temp-file swap
- HEIC/TIFF preview generation only once per file (cache by filename)
- Enable per-day rendering to limit memory footprint

## 9. testing & CI

- Vitest with `threads` pool, cap ≤ 8 workers, `allowOnly: false`
- Coverage with `@vitest/coverage-v8`, thresholds ≥ 70% branches
- Use `jsdom` for renderer-related tests
- Place tests in `__tests__/` or `*.test.ts`/`*.test.tsx`
- Global setup via `./tests/vitest/vitest-setup.ts`
- Respect Vite aliases like `#lib`, `#components` if present
- CI (detected via `TF_BUILD`):
  - Output JUnit to `./test-results/junit.xml`
  - Coverage to `./test-results/coverage/` with `junit`, `html`, `text-summary`

### test areas

- Schema validation: happy path + invariants violations
- Normalize-link: DB split to parts, part GUIDs, reply/tapback linking parity
- Enrich-ai: image→preview, audio transcription prompt, link fallbacks
- Render-markdown: deterministic snapshot outputs given fixed input
- Date handling: CSV UTC and DB Apple epoch → ISO `Z` round-trip
- Path resolution: absolute paths required; provenance retained

## 10. migration plan

- Phase 1: Extract schema to `src/schema/message.ts` with Zod
- Phase 2: Build `normalize-link` and validate CSV ingest output
- Phase 3: Add DB ingest alignment; split rows and part GUIDs
- Phase 4: Extract `enrich-ai`; preserve checkpoints and stats
- Phase 5: Extract `render-markdown`; maintain output layout
- Phase 6: Wire CI, coverage, snapshots, and validator CLI

## 11. task decomposition

### epics

- E1: Unified schema + validator
- E2: Normalize-link implementation
- E3: Enrich-ai extraction and hardening
- E4: Render-markdown extraction and parity
- E5: CI/test coverage and tooling
- E6: Docs and migration

### detailed tasks

E1 — schema & validator

- T1.1 Create `src/schema/message.ts` with types and Zod
- T1.2 Implement `scripts/validate-json.mts` to validate artifacts
- T1.3 Add fixtures and unit tests for schema invariants

E2 — normalize-link

- T2.1 Implement CSV→schema mapping
- T2.2 Implement DB row split into parts with `p:<index>/<guid>`
- T2.3 Implement reply/tapback linking (DB association first)
- T2.4 Dedup across CSV/DB; prefer DB for authoritative fields
- T2.5 Absolute path enforcement and provenance stamping
- T2.6 Date validator (ISO `Z`) and Apple epoch conversion checks
- T2.7 Zod validation + error reporting
- T2.8 Tests: split, linking parity, dedup, dates, paths

E3 — enrich-ai

- T3.1 Port image analysis + preview creation
- T3.2 Port audio transcription prompt and parsers
- T3.3 Port PDF summary and video handling
- T3.4 Port link enrichment with fallbacks; add provider stubs for tests
- T3.5 Implement idempotency by `media.id` + `kind`
- T3.6 Checkpointing and resume logic (atomic writes)
- T3.7 Rate limiting and retry policy with jitter
- T3.8 Tests: enrichment idempotency, rate limit gates, checkpoints

E4 — render-markdown

- T4.1 Port grouping (date/time-of-day) and anchors
- T4.2 Render nested replies/tapbacks; emoji mapping
- T4.3 Embed images with previews; quote transcripts and link context
- T4.4 Determinism tests with snapshots; no network calls

E5 — CI/tests/tooling

- T5.1 Vitest config (threads ≤ 8, jsdom where needed)
- T5.2 Coverage V8 with thresholds; CI reporters and outputs
- T5.3 Setup tests runner scripts in `package.json` (pnpm)
- T5.4 Add `renderWithProviders` test helper (if React involved later)

E6 — docs & migration

- T6.1 Update refactor report with any deltas from impl
- T6.2 Usage docs: how to run each stage and E2E
- T6.3 Troubleshooting: dates, paths, missing media, rate limits

## 12. acceptance criteria

Global

- A1. All produced dates are ISO 8601 with `Z`
- A2. All media paths in normalized and enriched outputs are absolute when files
  exist; missing files retain filename with provenance
- A3. Schema validation passes (`validate-json`) for all artifacts
- A4. CI runs Vitest with `allowOnly: false`, producing JUnit + coverage
- A5. Coverage thresholds met (≥ 70% branches global)

Normalize-link

- N1. DB messages with `n` attachments become 1 text + `n` media messages, each
  with stable part GUIDs `p:<index>/<guid>`
- N2. Replies/tapbacks link to the correct parent GUIDs; parity with CSV rules
- N3. Dedup merges CSV/DB without losing data; GUID stability retained
- N4. Paths are absolute and dated filename rules are enforced
- N5. Dates from CSV and DB align to UTC ISO `Z`

Enrich-ai

- E1. Image HEIC/TIFF produce a JPG preview once and reuse it
- E2. Audio transcription includes timestamps, speaker labels, and a short
  description; stored under `media.enrichment`
- E3. Link context uses Firecrawl when possible; falls back to YouTube/Spotify/
  social heuristics; never crashes the run
- E4. Idempotency: re-running enrich does not duplicate entries for the same
  `media.id` + `kind`
- E5. Checkpointing: `--resume` restarts within ≤ 1 item of prior state

Render-markdown

- R1. Output is deterministic for a fixed `messages.enriched.json`
- R2. Sections grouped by Morning/Afternoon/Evening with deep-link anchors
- R3. Replies/tapbacks rendered as nested quotes; emoji reactions map as
  documented
- R4. Embeds prefer previews for HEIC/TIFF and link to original where relevant
- R5. Link contexts and transcriptions appear as blockquotes under the message

## 13. risks & mitigations

- Rate limits and API changes → implement jittered retries and provider
  abstraction; local-only mode fallback
- Missing or moved attachments → absolute path enforcement, provenance, and
  warnings with counters
- Timezone drift and date bugs → end-to-end date validator and fixtures
- Heuristic linking ambiguity → prefer DB associations; log ties and expose
  review tooling

## 14. milestones

- M1: Schema + validator + fixtures
- M2: Normalize-link with CSV parity and tests
- M3: DB split + linking parity + dates/paths validator
- M4: Enrich-ai extraction with checkpoints and idempotency
- M5: Render-markdown deterministic parity with snapshots
- M6: CI green with coverage, docs finalized
