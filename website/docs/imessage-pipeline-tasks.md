# iMessage Pipeline Implementation Tasks

> Comprehensive task breakdown from `imessage-pipeline-tech-spec.md`
>
> **Last updated**: 2025-10-17
>
> **Total tasks**: 30 across 6 epics
>
> **Tracking**: Task state managed in `imessage-pipeline-task-state.json`

## Task Status Legend

- [ ] **Pending** - Not started
- [~] **In Progress** - Currently being worked on
- [x] **Completed** - Finished and verified

## Epic Overview

| Epic                   | Tasks  | Risk Profile                  | Est. Days   |
| ---------------------- | ------ | ----------------------------- | ----------- |
| E1: Schema & Validator | 3      | 1 MEDIUM, 2 LOW               | 6 days      |
| E2: Normalize-Link     | 8      | 3 HIGH, 2 MEDIUM, 3 LOW       | 24 days     |
| E3: Enrich-AI          | 8      | 5 HIGH, 1 MEDIUM, 2 LOW       | 29 days     |
| E4: Render-Markdown    | 4      | 1 HIGH, 1 MEDIUM, 2 LOW       | 10 days     |
| E5: CI/Testing/Tooling | 4      | 1 MEDIUM, 3 LOW               | 6 days      |
| E6: Docs & Migration   | 3      | 3 LOW                         | 4 days      |
| **TOTAL**              | **30** | **10 HIGH, 5 MEDIUM, 15 LOW** | **79 days** |

---

## E1: Schema & Validator (Foundation)

### SCHEMA--T01: Create unified Message schema with Zod validation

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 3 days | **Depends on**:
None

**Description**: Implement TypeScript interfaces and Zod validators for the
unified Message model with discriminated union on messageKind.

**Acceptance Criteria**:

- [ ] **SCHEMA-T01-AC01**: Message interface with messageKind discriminated
      union ('text'|'media'|'tapback'|'notification')
- [ ] **SCHEMA-T01-AC02**: Zod schema with superRefine for cross-field
      invariants
- [ ] **SCHEMA-T01-AC03**: Media payload validation (exists and complete when
      messageKind='media')
- [ ] **SCHEMA-T01-AC04**: Tapback payload validation (exists when
      messageKind='tapback')
- [ ] **SCHEMA-T01-AC05**: ISO 8601 date validation with Z suffix enforced
- [ ] **SCHEMA-T01-AC06**: Absolute path validation for media.path when file
      exists

**Notes**: Foundation for entire pipeline. Complex cross-field invariants using
Zod superRefine. Create `src/schema/message.ts` with full schema from refactor
report.

---

### SCHEMA--T02: Build validator CLI script

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 1 day | **Depends on**:
SCHEMA--T01

**Description**: Create scripts/validate-json.mts CLI to validate message
artifacts against schema.

**Acceptance Criteria**:

- [ ] **SCHEMA-T02-AC01**: CLI accepts JSON file path as argument
- [ ] **SCHEMA-T02-AC02**: Validates against Message schema with detailed error
      messages including field paths
- [ ] **SCHEMA-T02-AC03**: Exit code 0 on success, 1 on validation failure
- [ ] **SCHEMA-T02-AC04**: Outputs summary stats (total messages, breakdown by
      messageKind)

**Notes**: Straightforward CLI script using Zod validation. Useful for debugging
pipeline outputs.

---

### SCHEMA--T03: Create fixtures and schema tests

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 2 days | **Depends on**:
SCHEMA--T01

**Description**: Build test fixtures for all messageKind types and unit tests
covering schema validation.

**Acceptance Criteria**:

- [ ] **SCHEMA-T03-AC01**: Happy path fixtures for all messageKind types (text,
      media, tapback, notification)
- [ ] **SCHEMA-T03-AC02**: Invariant violation fixtures (media without payload,
      tapback without payload, etc.)
- [ ] **SCHEMA-T03-AC03**: Date format violation fixtures (missing Z, invalid
      ISO 8601)
- [ ] **SCHEMA-T03-AC04**: Unit tests cover all Zod schema branches with >80%
      coverage

**Notes**: Data setup task. Create test fixtures in `__tests__/fixtures/`
directory. Tests verify schema catches all invariant violations.

---

## E2: Normalize-Link (Data Integration)

### NORMALIZE--T01: Implement CSV to schema mapping

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 2 days | **Depends on**:
SCHEMA--T01

**Description**: Build ingest-csv component to parse iMazing CSV and convert to
Message schema.

**Acceptance Criteria**:

- [ ] **NORMALIZE-T01-AC01**: Parse iMazing CSV rows with correct field mapping
      per CSV header
- [ ] **NORMALIZE-T01-AC02**: Split rows into text/media/tapback/notification by
      analyzing content
- [ ] **NORMALIZE-T01-AC03**: Convert CSV dates to ISO 8601 UTC with Z suffix
- [ ] **NORMALIZE-T01-AC04**: Resolve iMazing attachment paths to absolute paths
      when files exist
- [ ] **NORMALIZE-T01-AC05**: Preserve row metadata (source, line number) for
      provenance

**Notes**: Well-defined CSV schema mapping. Output to
`messages.csv.ingested.json`. Handle iMazing attachment path patterns.

---

### NORMALIZE--T02: Implement DB row splitting with part GUIDs

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 3 days | **Depends on**:
SCHEMA--T01

**Description**: Build logic to split Messages.app DB rows with attachments into
1 text + N media messages with stable part GUIDs.

**Acceptance Criteria**:

- [ ] **NORMALIZE-T02-AC01**: Split DB messages with n attachments into 1 text
      message + n media messages
- [ ] **NORMALIZE-T02-AC02**: Generate stable part GUIDs using format
      `p:<index>/<original_guid>`
- [ ] **NORMALIZE-T02-AC03**: Preserve parent GUID reference in each part's
      metadata
- [ ] **NORMALIZE-T02-AC04**: Convert Apple epoch timestamps to ISO 8601 UTC
      with Z
- [ ] **NORMALIZE-T02-AC05**: Maintain chronological ordering within split parts
      using index

**Notes**: Critical for media-as-message model. Stable part GUID generation
crucial for dedup. Handle Apple epoch conversion carefully.

---

### NORMALIZE--T03: Implement reply and tapback linking ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 5 days | **Depends on**:
NORMALIZE--T01, NORMALIZE--T02

**Description**: Build linking logic using DB associations first, then
heuristics for unlinked messages.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **NORMALIZE-T03-AC01**: Link replies using DB association_guid as primary
      method
- [ ] **NORMALIZE-T03-AC02**: Apply heuristics for unlinked replies (timestamp
      proximity `<30s`, content patterns)
- [ ] **NORMALIZE-T03-AC03**: Link tapbacks to parent message GUIDs (including
      part GUIDs)
- [ ] **NORMALIZE-T03-AC04**: Handle ambiguous links with structured logging and
      tie counters
- [ ] **NORMALIZE-T03-AC05**: Maintain parity with CSV linking rules from
      original analyzer

**Notes**: Heuristic ambiguity is main concern per spec §13. Prefer DB
associations, log all ties. Test extensively with edge cases.

---

### NORMALIZE--T04: Implement deduplication across sources ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 4 days | **Depends on**:
NORMALIZE--T01, NORMALIZE--T02

**Description**: Merge CSV and DB sources with deduplication by GUID equivalence
and content similarity.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **NORMALIZE-T04-AC01**: Merge CSV and DB by exact GUID match as primary
      strategy
- [ ] **NORMALIZE-T04-AC02**: Prefer DB values for authoritative fields
      (timestamps, associations, handle)
- [ ] **NORMALIZE-T04-AC03**: Detect content equivalence for messages without
      matching GUIDs (normalize text + compare)
- [ ] **NORMALIZE-T04-AC04**: Verify no data loss during merge with count
      invariants (input count >= output count)
- [ ] **NORMALIZE-T04-AC05**: Ensure stable GUID assignment across multiple runs
      (deterministic merge)

**Notes**: Data loss risk per spec §13. Implement count verification and
detailed merge logging. Test with overlapping datasets.

---

### NORMALIZE--T05: Implement absolute path enforcement

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 2 days | **Depends on**:
NORMALIZE--T01, NORMALIZE--T02

**Description**: Enforce absolute paths for all media files, retain filename
with provenance for missing files.

**Acceptance Criteria**:

- [ ] **NORMALIZE-T05-AC01**: All media.path fields are absolute paths when
      files exist on disk
- [ ] **NORMALIZE-T05-AC02**: Missing files retain original filename with
      provenance metadata (source, last_seen)
- [ ] **NORMALIZE-T05-AC03**: Path validation errors reported with counters
      (found vs missing)
- [ ] **NORMALIZE-T05-AC04**: Support multiple attachment root directories from
      config

**Notes**: Missing file handling per spec §13. Use config for attachment roots.
Log missing file warnings with counts.

---

### NORMALIZE--T06: Build date validator and converters ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 3 days | **Depends on**:
NORMALIZE--T01, NORMALIZE--T02

**Description**: Create robust date handling for CSV UTC and DB Apple epoch with
end-to-end validation.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **NORMALIZE-T06-AC01**: All timestamps in output are ISO 8601 with Z
      suffix (UTC)
- [ ] **NORMALIZE-T06-AC02**: Apple epoch (Mac absolute time = seconds since
      2001-01-01) converts correctly to UTC
- [ ] **NORMALIZE-T06-AC03**: CSV UTC timestamps preserve timezone information
      (no drift)
- [ ] **NORMALIZE-T06-AC04**: End-to-end date round-trip validation passes
      (parse → convert → validate)

**Notes**: Timezone drift risk per spec §13. Test with known timestamps and DST
boundaries. Fixtures for edge cases.

---

### NORMALIZE--T07: Add Zod validation layer

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 2 days | **Depends on**:
NORMALIZE--T01-T06

**Description**: Apply Zod validation to all normalized messages with
comprehensive error reporting.

**Acceptance Criteria**:

- [ ] **NORMALIZE-T07-AC01**: Run Zod schema validation on all normalized
      messages before output
- [ ] **NORMALIZE-T07-AC02**: Error reporting includes field path and validation
      failure reason (use Zod's error formatting)
- [ ] **NORMALIZE-T07-AC03**: Batch validation with error collection (don't
      fail-fast, report all errors)
- [ ] **NORMALIZE-T07-AC04**: camelCase field enforcement via Zod schema (reject
      snake_case)

**Notes**: Final validation gate. Output to `messages.normalized.json`. Collect
all validation errors for debugging.

---

### NORMALIZE--T08: Create normalize-link test suite

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 3 days | **Depends on**:
NORMALIZE--T07

**Description**: Comprehensive tests for split, linking, dedup, dates, and paths
with >70% coverage.

**Acceptance Criteria**:

- [ ] **NORMALIZE-T08-AC01**: Unit tests for DB split logic with various
      attachment counts (0, 1, 5, 10)
- [ ] **NORMALIZE-T08-AC02**: Integration tests for linking parity between CSV
      and DB sources
- [ ] **NORMALIZE-T08-AC03**: Dedup tests with overlapping CSV/DB datasets
      (exact match, content match, no match)
- [ ] **NORMALIZE-T08-AC04**: Date conversion tests for edge cases (DST
      boundaries, leap seconds, epoch boundaries)
- [ ] **NORMALIZE-T08-AC05**: Path resolution tests with missing files and
      multiple roots

**Notes**: Test after implementation. Aim for >70% branch coverage per spec §9.
Use fixtures from T03.

---

## E3: Enrich-AI (Augmentation)

### ENRICH--T01: Implement image analysis with preview generation ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 4 days | **Depends on**:
SCHEMA--T01, NORMALIZE--T07

**Description**: Port image analysis: HEIC/TIFF → JPG preview, Gemini vision
caption/summary.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **ENRICH-T01-AC01**: HEIC files convert to JPG preview with quality
      preservation (≥90% quality)
- [ ] **ENRICH-T01-AC02**: TIFF files convert to JPG preview
- [ ] **ENRICH-T01-AC03**: Preview generated once per file and cached by
      filename (skip if preview exists)
- [ ] **ENRICH-T01-AC04**: Gemini vision API call with structured prompt for
      caption + summary
- [ ] **ENRICH-T01-AC05**: Parse API response into enrichment array with
      kind='image_analysis'
- [ ] **ENRICH-T01-AC06**: Store provenance (provider, model, version,
      timestamp) in enrichment entry

**Notes**: HEIC/TIFF handling complexity per spec §8. Cache preview by filename
to avoid regeneration. Use sharp/imagemagick for conversion.

---

### ENRICH--T02: Implement audio transcription with structured output ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 4 days | **Depends on**:
SCHEMA--T01, NORMALIZE--T07

**Description**: Port audio transcription: structured prompt, timestamps,
speaker labels, short description.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **ENRICH-T02-AC01**: Use structured prompt for transcription requesting
      timestamps and speakers
- [ ] **ENRICH-T02-AC02**: Extract speaker labels if available (Speaker 1,
      Speaker 2, etc.)
- [ ] **ENRICH-T02-AC03**: Generate short description (1-2 sentences)
      summarizing audio content
- [ ] **ENRICH-T02-AC04**: Store under media.enrichment with
      kind='transcription'
- [ ] **ENRICH-T02-AC05**: Handle long audio files (>10min) with streaming or
      chunking strategy

**Notes**: Prompt engineering critical per spec. Test with various audio lengths
and qualities. Store full transcript + short description.

---

### ENRICH--T03: Implement PDF and video handling

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 2 days | **Depends on**:
SCHEMA--T01, NORMALIZE--T07

**Description**: PDF summarization via Gemini, video copied with note (no heavy
processing).

**Acceptance Criteria**:

- [ ] **ENRICH-T03-AC01**: PDF summarization via Gemini with page limit (e.g.,
      first 10 pages)
- [ ] **ENRICH-T03-AC02**: Video files copied to output with metadata note only
      (no transcription by default)
- [ ] **ENRICH-T03-AC03**: Fallback to filename when summarization fails (with
      error logging)
- [ ] **ENRICH-T03-AC04**: Track unsupported formats in error log with counts

**Notes**: PDF handling varies by format. Video is out of scope per spec §1. Log
unsupported formats.

---

### ENRICH--T04: Implement link enrichment with fallbacks ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 5 days | **Depends on**:
SCHEMA--T01, NORMALIZE--T07

**Description**: Firecrawl primary, YouTube/Spotify/social fallbacks, resilient
error handling.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **ENRICH-T04-AC01**: Firecrawl as primary provider for generic link
      context extraction
- [ ] **ENRICH-T04-AC02**: YouTube fallback using title/channel extraction from
      page source or API
- [ ] **ENRICH-T04-AC03**: Spotify fallback using track/artist extraction from
      embed data
- [ ] **ENRICH-T04-AC04**: Social media fallbacks (Twitter/Instagram) using meta
      tags and structured data
- [ ] **ENRICH-T04-AC05**: Never crash on link enrichment failure (wrap in
      try/catch, log error, continue)
- [ ] **ENRICH-T04-AC06**: Store enrichment with kind='link_context' and
      provider provenance

**Notes**: Rate limits and API changes per spec §13. Provider abstraction for
easy mocking. Test all fallback paths.

---

### ENRICH--T05: Implement enrichment idempotency ⚠️ HIGH RISK

**Status**: [x] Completed | **Risk**: HIGH | **Est**: 3 days | **Depends on**:
ENRICH--T01, ENRICH--T02, ENRICH--T03, ENRICH--T04

**Description**: Skip enrichment if media.id + kind already exists, prevent
duplicate entries.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [x] **ENRICH-T05-AC01**: Skip enrichment if media.enrichment already contains
      entry with matching kind
- [x] **ENRICH-T05-AC02**: Deduplicate enrichment array by kind before adding
      new entries
- [x] **ENRICH-T05-AC03**: Re-running enrich-ai does not create duplicate
      entries (verified with tests)
- [x] **ENRICH-T05-AC04**: Support --force-refresh flag to override idempotency
      and re-enrich

**Notes**: Completed with Wallaby TDD. Created src/enrich/idempotency.ts with
comprehensive test coverage (92.31% branches). All 27 tests passing (19 unit + 8
integration).

---

### ENRICH--T06: Implement checkpointing and resume logic ⚠️ HIGH RISK

**Status**: [x] Completed | **Risk**: HIGH | **Est**: 4 days | **Depends on**:
ENRICH--T05

**Description**: Atomic checkpoint writes, resume within ≤1 item, config
consistency verification.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [x] **ENRICH-T06-AC01**: Write checkpoint after every N items (configurable,
      default 100)
- [x] **ENRICH-T06-AC02**: Checkpoint includes: last_index, partial_outputs,
      stats (processed/failed), failed_items array
- [x] **ENRICH-T06-AC03**: Atomic checkpoint writes using temp file + rename
      pattern
- [x] **ENRICH-T06-AC04**: Resume flag (--resume) restarts within ≤1 item of
      last checkpoint per spec §12 AC E5
- [x] **ENRICH-T06-AC05**: Verify config consistency (hash comparison) before
      resuming, fail if mismatch

**Notes**: Completed with Wallaby TDD. Created src/enrich/checkpoint.ts with 29
unit tests (all passing). Coverage: 60% branches.

---

### ENRICH--T07: Implement rate limiting and retry logic ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 3 days | **Depends on**:
ENRICH--T01, ENRICH--T02, ENRICH--T03, ENRICH--T04

**Description**: Configurable delays, exponential backoff with jitter, circuit
breaker.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **ENRICH-T07-AC01**: Respect configurable rateLimitDelay between API calls
      (default 1000ms)
- [ ] **ENRICH-T07-AC02**: Exponential backoff for 429 responses: 2^n seconds
      with +/- 25% jitter
- [ ] **ENRICH-T07-AC03**: Retry 5xx errors with maxRetries limit (default 3)
- [ ] **ENRICH-T07-AC04**: Respect Retry-After header when present in 429/503
      responses
- [ ] **ENRICH-T07-AC05**: Circuit breaker after N consecutive failures
      (default 5) to prevent cascading failures

**Notes**: Rate limit handling per spec §6, §13. Test with mock rate limit
responses. Jitter prevents thundering herd.

---

### ENRICH--T08: Create enrich-ai test suite

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 3 days | **Depends on**:
ENRICH--T05, ENRICH--T06, ENRICH--T07

**Description**: Mock providers, idempotency tests, checkpoint tests, rate limit
tests, integration tests.

**Acceptance Criteria**:

- [ ] **ENRICH-T08-AC01**: Mock providers for image/audio/link enrichment (no
      real API calls in tests)
- [ ] **ENRICH-T08-AC02**: Idempotency tests verify no duplicate enrichments on
      multiple runs
- [ ] **ENRICH-T08-AC03**: Checkpoint resume tests verify state restoration
      within ≤1 item
- [ ] **ENRICH-T08-AC04**: Rate limit gate tests verify delay enforcement and
      backoff behavior
- [ ] **ENRICH-T08-AC05**: Integration tests with real file fixtures (small
      samples, no API calls)

**Notes**: Test after implementation. Use MSW for API mocking. Aim for >70%
branch coverage. Test failure scenarios.

---

## E4: Render-Markdown (Output Generation)

### RENDER--T01: Implement grouping and anchor generation

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 2 days | **Depends on**:
SCHEMA--T01, ENRICH--T06

**Description**: Group by date and time-of-day, generate Obsidian-friendly
deep-link anchors.

**Acceptance Criteria**:

- [ ] **RENDER-T01-AC01**: Group messages by date (YYYY-MM-DD) into separate
      markdown files
- [ ] **RENDER-T01-AC02**: Sub-group by time-of-day: Morning (00:00-11:59),
      Afternoon (12:00-17:59), Evening (18:00-23:59)
- [ ] **RENDER-T01-AC03**: Generate unique anchor IDs for each message (e.g.,
      `#msg-{guid}`)
- [ ] **RENDER-T01-AC04**: Deep-link anchors work in Obsidian (clickable,
      navigable)
- [ ] **RENDER-T01-AC05**: Maintain chronological ordering within time-of-day
      groups

**Notes**: Straightforward grouping logic. Output per-day markdown files to
configured outputDir.

---

### RENDER--T02: Implement nested reply and tapback rendering

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 3 days | **Depends on**:
RENDER--T01

**Description**: Render replies as nested blockquotes, tapbacks as emoji
reactions with mapping.

**Acceptance Criteria**:

- [ ] **RENDER-T02-AC01**: Render replies as nested blockquotes (> prefix) under
      parent message
- [ ] **RENDER-T02-AC02**: Render tapbacks as emoji reactions using documented
      emoji mapping
- [ ] **RENDER-T02-AC03**: Handle multi-level nesting (reply to reply) with
      increasing indentation
- [ ] **RENDER-T02-AC04**: Indent levels match conversation depth (2 spaces per
      level)
- [ ] **RENDER-T02-AC05**: Preserve sender attribution in nested content (e.g.,
      **Sender**: message)

**Notes**: Quote depth handling complexity. Test deeply nested threads. Emoji
mapping from refactor report.

---

### RENDER--T03: Implement embeds and blockquotes

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 2 days | **Depends on**:
RENDER--T01

**Description**: Obsidian image embeds with preview preference,
transcription/link context blockquotes.

**Acceptance Criteria**:

- [ ] **RENDER-T03-AC01**: Embed images using Obsidian ![[path]] syntax
- [ ] **RENDER-T03-AC02**: Use preview image path for HEIC/TIFF with link to
      original in caption
- [ ] **RENDER-T03-AC03**: Quote audio transcriptions as blockquotes under media
      message
- [ ] **RENDER-T03-AC04**: Quote link contexts as blockquotes under text message
      containing link
- [ ] **RENDER-T03-AC05**: Format PDF summaries as blockquotes with > prefix

**Notes**: Formatting task. Prefer preview images per spec §12 AC R4. Test
various media types.

---

### RENDER--T04: Create determinism test suite ⚠️ HIGH RISK

**Status**: [ ] Pending | **Risk**: HIGH | **Est**: 3 days | **Depends on**:
RENDER--T01, RENDER--T02, RENDER--T03

**Description**: Snapshot tests verifying deterministic output, no network
calls, performance validation.

**TDD Required**: Yes - Red-Green-Refactor cycle mandatory

**Acceptance Criteria**:

- [ ] **RENDER-T04-AC01**: Snapshot tests for fixed input produce identical
      output across runs
- [ ] **RENDER-T04-AC02**: No network calls during rendering (verify with
      network mocks or offline mode)
- [ ] **RENDER-T04-AC03**: Deterministic ordering of same-timestamp messages
      (stable sort by guid)
- [ ] **RENDER-T04-AC04**: Reproducible markdown structure verified with diff
      comparison
- [ ] **RENDER-T04-AC05**: Performance test: render 1000 messages in `<10s`

**Notes**: Determinism critical per spec §12 AC R1. Use Vitest snapshot testing.
Verify no network activity.

---

## E5: CI/Testing/Tooling (Infrastructure)

### CI--T01: Configure Vitest with proper settings

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 1 day | **Depends on**:
SCHEMA--T01

**Description**: Setup Vitest with threads pool, CI detection, jsdom, global
setup, aliases.

**Acceptance Criteria**:

- [ ] **CI-T01-AC01**: Configure threads pool with maxForks ≤ 8 for parallel
      execution
- [ ] **CI-T01-AC02**: Set allowOnly: false to prevent .only in CI per spec §9
- [ ] **CI-T01-AC03**: Configure jsdom environment for renderer-related tests
- [ ] **CI-T01-AC04**: Setup global test setup file at
      tests/vitest/vitest-setup.ts
- [ ] **CI-T01-AC05**: Configure Vite aliases (#lib, #components) in
      vitest.config.ts

**Notes**: Configuration task. Create vitest.config.ts following spec §9
requirements.

---

### CI--T02: Setup coverage with thresholds and CI reporters

**Status**: [ ] Pending | **Risk**: MEDIUM | **Est**: 2 days | **Depends on**:
CI--T01

**Description**: Install coverage-v8, configure thresholds ≥70%, CI output
formats (JUnit, HTML, text-summary).

**Acceptance Criteria**:

- [ ] **CI-T02-AC01**: Install and configure @vitest/coverage-v8
- [ ] **CI-T02-AC02**: Set branch coverage threshold ≥70% per spec §9
- [ ] **CI-T02-AC03**: CI outputs JUnit XML to ./test-results/junit.xml
- [ ] **CI-T02-AC04**: Coverage reports to ./test-results/coverage/ with
      formats: junit, html, text-summary
- [ ] **CI-T02-AC05**: Detect CI environment via TF_BUILD variable

**Notes**: Coverage thresholds must be met. Configure reporters for Azure DevOps
integration. Test CI detection.

---

### CI--T03: Add package.json test scripts

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 1 day | **Depends on**:
CI--T01

**Description**: Create pnpm scripts for test, test:coverage, test:ci, lint,
build.

**Acceptance Criteria**:

- [ ] **CI-T03-AC01**: pnpm test runs vitest with proper config
- [ ] **CI-T03-AC02**: pnpm test:coverage generates coverage reports with
      thresholds
- [ ] **CI-T03-AC03**: pnpm test:ci runs with CI-specific settings (reporters,
      etc.)
- [ ] **CI-T03-AC04**: pnpm lint runs ESLint on all TypeScript files
- [ ] **CI-T03-AC05**: pnpm build compiles TypeScript with proper config

**Notes**: Package.json script setup. Standard pnpm workspace patterns.

---

### CI--T04: Create test helper utilities

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 2 days | **Depends on**:
CI--T01

**Description**: Build test helpers: renderWithProviders (if React), mock
providers, fixture loaders, schema assertions.

**Acceptance Criteria**:

- [ ] **CI-T04-AC01**: renderWithProviders helper for React components (if
      needed per spec §5.4)
- [ ] **CI-T04-AC02**: Mock provider setup utilities for AI services (Gemini,
      Firecrawl)
- [ ] **CI-T04-AC03**: Fixture loading helpers for JSON message datasets
- [ ] **CI-T04-AC04**: Assertion utilities for schema validation (wrappers
      around Zod)

**Notes**: Test utilities. Create in `tests/helpers/` directory. React helpers
only if UI components added later.

---

## E6: Docs & Migration (Knowledge Transfer)

### DOCS--T01: Update refactor report with implementation deltas

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 1 day | **Depends on**:
NORMALIZE--T08, ENRICH--T08, RENDER--T04

**Description**: Document any changes from spec during implementation, update
diagrams, capture lessons learned.

**Acceptance Criteria**:

- [ ] **DOCS-T01-AC01**: Document all implementation deltas from original spec
- [ ] **DOCS-T01-AC02**: Update architecture diagrams if component structure
      changed
- [ ] **DOCS-T01-AC03**: Capture lessons learned and implementation gotchas
- [ ] **DOCS-T01-AC04**: Link to all new files created with brief descriptions

**Notes**: Documentation task. Update
`documentation/imessage-pipeline-refactor-report.md` with implementation notes.

---

### DOCS--T02: Write comprehensive usage documentation

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 2 days | **Depends on**:
NORMALIZE--T08, ENRICH--T08, RENDER--T04

**Description**: Document how to run each stage, end-to-end workflow,
configuration, environment setup, CLI usage.

**Acceptance Criteria**:

- [ ] **DOCS-T02-AC01**: Document how to run each stage: ingest-csv, ingest-db,
      normalize-link, enrich-ai, render-markdown
- [ ] **DOCS-T02-AC02**: End-to-end workflow example with sample data and
      expected outputs
- [ ] **DOCS-T02-AC03**: Configuration file documentation with all available
      options and defaults
- [ ] **DOCS-T02-AC04**: Environment variable setup guide (API keys:
      GEMINI_API_KEY, FIRECRAWL_API_KEY)
- [ ] **DOCS-T02-AC05**: CLI flags and options documentation for each command

**Notes**: Usage documentation. Create
`documentation/imessage-pipeline-usage.md`. Include examples and screenshots.

---

### DOCS--T03: Create troubleshooting guide

**Status**: [ ] Pending | **Risk**: LOW | **Est**: 1 day | **Depends on**:
NORMALIZE--T08, ENRICH--T08, RENDER--T04

**Description**: Document common issues: dates/timezones, missing files, rate
limits, checkpoint failures, validation errors.

**Acceptance Criteria**:

- [ ] **DOCS-T03-AC01**: Date/timezone issues troubleshooting (Apple epoch, DST,
      UTC conversion)
- [ ] **DOCS-T03-AC02**: Missing media files troubleshooting (path resolution,
      attachment roots)
- [ ] **DOCS-T03-AC03**: Rate limit handling guide (429 errors, backoff, circuit
      breaker)
- [ ] **DOCS-T03-AC04**: Checkpoint resume failures (config mismatch, corrupted
      checkpoint)
- [ ] **DOCS-T03-AC05**: Common validation errors and fixes (schema violations,
      missing fields)

**Notes**: Troubleshooting documentation. Create
`documentation/imessage-pipeline-troubleshooting.md`. FAQ format.

---

## Dependency Graph

```
E1 (Schema) - Foundation
├── SCHEMA--T01 → SCHEMA--T02
├── SCHEMA--T01 → SCHEMA--T03
└── SCHEMA--T01 → CI--T01

E2 (Normalize) - Data Integration
├── SCHEMA--T01 → NORMALIZE--T01
├── SCHEMA--T01 → NORMALIZE--T02
├── NORMALIZE--T01, T02 → NORMALIZE--T03 (HIGH RISK)
├── NORMALIZE--T01, T02 → NORMALIZE--T04 (HIGH RISK)
├── NORMALIZE--T01, T02 → NORMALIZE--T05
├── NORMALIZE--T01, T02 → NORMALIZE--T06 (HIGH RISK)
├── NORMALIZE--T01-T06 → NORMALIZE--T07
└── NORMALIZE--T07 → NORMALIZE--T08

E3 (Enrich) - AI Augmentation
├── SCHEMA--T01, NORMALIZE--T07 → ENRICH--T01 (HIGH RISK)
├── SCHEMA--T01, NORMALIZE--T07 → ENRICH--T02 (HIGH RISK)
├── SCHEMA--T01, NORMALIZE--T07 → ENRICH--T03
├── SCHEMA--T01, NORMALIZE--T07 → ENRICH--T04 (HIGH RISK)
├── ENRICH--T01-T04 → ENRICH--T05 (HIGH RISK)
├── ENRICH--T05 → ENRICH--T06 (HIGH RISK)
├── ENRICH--T01-T04 → ENRICH--T07 (HIGH RISK)
└── ENRICH--T05, T06, T07 → ENRICH--T08

E4 (Render) - Markdown Generation
├── SCHEMA--T01, ENRICH--T06 → RENDER--T01
├── RENDER--T01 → RENDER--T02
├── RENDER--T01 → RENDER--T03
└── RENDER--T01, T02, T03 → RENDER--T04 (HIGH RISK)

E5 (CI) - Infrastructure
├── SCHEMA--T01 → CI--T01
├── CI--T01 → CI--T02
├── CI--T01 → CI--T03
└── CI--T01 → CI--T04

E6 (Docs) - Knowledge Transfer
├── All E2, E3, E4 → DOCS--T01
├── All E2, E3, E4 → DOCS--T02
└── All E2, E3, E4 → DOCS--T03
```

---

## High Risk Tasks (TDD Required)

These tasks require strict Test-Driven Development (Red-Green-Refactor cycle):

1. **NORMALIZE--T03**: Reply/tapback linking (heuristic ambiguity)
2. **NORMALIZE--T04**: Deduplication (data loss risk)
3. **NORMALIZE--T06**: Date conversion (timezone drift)
4. **ENRICH--T01**: Image preview generation (HEIC/TIFF complexity)
5. **ENRICH--T02**: Audio transcription (prompt engineering)
6. **ENRICH--T04**: Link enrichment (rate limits, API changes)
7. **ENRICH--T05**: Idempotency (duplicate prevention)
8. **ENRICH--T06**: Checkpointing (resume correctness)
9. **ENRICH--T07**: Rate limiting (retry logic)
10. **RENDER--T04**: Determinism (output reproducibility)

---

## Milestones

- **M1**: Schema + validator + fixtures (E1 complete) → **6 days**
- **M2**: Normalize-link with CSV parity and tests (E2 complete) → **+24 days**
  (30 total)
- **M3**: DB split + linking parity + dates/paths validator → (part of M2)
- **M4**: Enrich-ai extraction with checkpoints and idempotency (E3 complete) →
  **+29 days** (59 total)
- **M5**: Render-markdown deterministic parity with snapshots (E4 complete) →
  **+10 days** (69 total)
- **M6**: CI green with coverage, docs finalized (E5, E6 complete) → **+10
  days** (79 total)

---

## Usage for Agents

### Updating Task Status

1. Start a task:
   - Update `status` to `"in_progress"`
   - Set `started_at` to current ISO 8601 timestamp
   - Begin working through acceptance criteria

2. Complete acceptance criteria:
   - Move AC ID from `acs_remaining` to `acs_completed`
   - Add notes about implementation details

3. Complete a task:
   - Update `status` to `"completed"`
   - Set `completed_at` to current ISO 8601 timestamp
   - Ensure all ACs are in `acs_completed`
   - Final notes summarizing work and any deviations

### Example Update

```json
{
  "SCHEMA--T01": {
    "acs_completed": ["SCHEMA-T01-AC01", "SCHEMA-T01-AC02"],
    "acs_remaining": [
      "SCHEMA-T01-AC03",
      "SCHEMA-T01-AC04",
      "SCHEMA-T01-AC05",
      "SCHEMA-T01-AC06"
    ],
    "completed_at": null,
    "notes": "In progress. Completed Message interface and basic Zod schema. Working on cross-field invariants next.",
    "started_at": "2025-10-17T14:30:00.000Z",
    "status": "in_progress"
  }
}
```

---

**Generated from**: `documentation/imessage-pipeline-tech-spec.md` **Tracking
file**: `documentation/imessage-pipeline-task-state.json` **Last updated**:
2025-10-17
