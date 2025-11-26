# iMessage Pipeline Troubleshooting Guide

**Version**: 1.0 **Last Updated**: 2025-10-19 **Project**: iMessage Timeline
Refactor

---

## Table of Contents

1. [Date and Timezone Issues](#date-and-timezone-issues)
2. [Missing Media Files](#missing-media-files)
3. [Rate Limiting and API Errors](#rate-limiting-and-api-errors)
4. [Checkpoint and Resume Failures](#checkpoint-and-resume-failures)
5. [Validation Errors](#validation-errors)
6. [Performance Issues](#performance-issues)
7. [Common Error Messages](#common-error-messages)

---

## Date and Timezone Issues

### Problem: "Date must end with Z suffix (UTC)"

**Symptom**: Validation fails with error about missing Z suffix.

```
❌ Validation failed:
  - date: Date must end with Z suffix (UTC)
```

**Cause**: Non-UTC timezone in CSV data or manual edits.

**Solution**:

```bash
# Check the problematic message in JSON
jq '.messages[] | select(.date | endswith("Z") | not)' normalized.json

# Convert dates to UTC during ingest
imessage-timeline ingest-csv \
  --input messages.csv \
  --output ingested.json \
  --force-utc
```

**Prevention**: Always use UTC dates. The pipeline enforces ISO 8601 with Z
suffix.

---

### Problem: Apple Epoch Conversion Errors

**Symptom**: Dates appear as year 1970 or 2159.

```
Date: 1970-01-01T00:00:00.000Z (should be 2024)
```

**Cause**:

- **1970**: Treating Apple epoch as Unix epoch
- **2159**: Apple epoch seconds interpreted as milliseconds

**Apple Epoch Details**:

- Apple epoch: Seconds since `2001-01-01 00:00:00 UTC`
- Valid range: `0` to `~5,000,000,000` (year 2159)
- Example: `756,864,000` = `2024-12-31 00:00:00 UTC`

**Solution**:

```typescript
// ✅ Correct: Add APPLE_EPOCH_SECONDS before converting
const APPLE_EPOCH_SECONDS = 978_307_200
const unixMs = (appleEpochSeconds + APPLE_EPOCH_SECONDS) * 1000
const date = new Date(unixMs).toISOString()

// ❌ Wrong: Treating as Unix timestamp
const date = new Date(appleEpochSeconds * 1000).toISOString()
```

**Verification**:

```bash
# Check date ranges in output
jq '.messages | map(.date) | unique | sort | .[0], .[-1]' normalized.json

# Should show reasonable date range:
# "2024-01-01T00:00:00.000Z"
# "2024-12-31T23:59:59.000Z"
```

---

### Problem: DST Boundaries Cause Duplicate/Missing Messages

**Symptom**: Messages near DST transitions appear duplicated or missing.

**DST Transition Times** (varies by region):

- **US**: March 2am → 3am (spring), November 2am → 1am (fall)
- **Australia**: October 2am → 3am (spring), April 3am → 2am (fall)

**Example Problem**:

```
2024-03-10T02:30:00Z (doesn't exist during spring DST)
2024-11-03T01:30:00Z (exists twice during fall DST)
```

**Solution**: The pipeline uses **UTC everywhere** to avoid DST issues.

```bash
# Verify all dates are UTC
jq '.messages[].date | select(endswith("Z") | not)' normalized.json

# Should return no results (empty output)
```

**If CSV has local times**:

```bash
# Convert during ingest with timezone offset
imessage-timeline ingest-csv \
  --input messages.csv \
  --output ingested.json \
  --source-timezone "America/New_York"
```

---

### Problem: Leap Second Handling

**Symptom**: Validation fails near leap second timestamps.

```
❌ Invalid date: 2024-12-31T23:59:60.000Z
```

**Cause**: Leap seconds (`23:59:60`) are valid in UTC but not in ISO 8601.

**Solution**: Normalize to `23:59:59.000Z`:

```typescript
// The pipeline handles this automatically in date-converters.ts
export function normalizeLeapSecond(dateString: string): string {
  return dateString.replace(/T23:59:60/, 'T23:59:59')
}
```

**Verification**:

```bash
# Check for leap second timestamps
grep -r "23:59:60" normalized.json

# Should be normalized to 23:59:59
```

---

## Missing Media Files

### Problem: "Attachment not found at path"

**Symptom**: Media messages missing files.

```
⚠ Missing files: 142/845
  - /Users/you/Library/Messages/Attachments/aa/10/IMG_1234.heic
  - /Users/you/Library/Messages/Attachments/bb/20/audio.m4a
```

**Common Causes**:

1. **Attachments deleted from disk**
2. **Wrong attachment root directory**
3. **Relative paths in CSV export**
4. **External storage not mounted**

**Solution 1: Configure Multiple Attachment Roots**

```bash
imessage-timeline ingest-csv \
  --input messages.csv \
  --output ingested.json \
  --attachment-roots \
    ~/Library/Messages/Attachments \
    /Volumes/Backup/old-messages/Attachments \
    /Volumes/External/iMessage-Archive
```

**Solution 2: Check Missing Files Report**

```bash
# Generate detailed missing files report
jq '.messages[] | select(.messageKind == "media" and .media.path == null) | {
  guid: .guid,
  filename: .media.filename,
  originalPath: .metadata.originalPath
}' ingested.json > missing-files.json

# Count missing by type
jq 'group_by(.filename | split(".") | .[-1]) | map({
  extension: .[0].filename | split(".") | .[-1],
  count: length
})' missing-files.json
```

**Solution 3: Locate Files Manually**

```bash
#!/bin/bash
# find-missing-attachments.sh

# Read missing files from report
jq -r '.[].filename' missing-files.json | while read filename; do
  echo "Searching for $filename..."

  # Search common locations
  find ~/Library/Messages/Attachments -name "$filename" 2>/dev/null
  find ~/Desktop -name "$filename" 2>/dev/null
  find /Volumes -name "$filename" 2>/dev/null
done
```

**Solution 4: Skip Missing Files**

```bash
# Continue pipeline with provenance metadata for missing files
imessage-timeline normalize-link \
  --input ingested.json \
  --output normalized.json \
  --keep-missing-files \
  --verbose

# Missing files will have:
# media.path = null
# metadata.lastSeenPath = "/original/path/IMG_1234.heic"
# metadata.fileStatus = "missing"
```

---

### Problem: HEIC/TIFF Conversion Fails

**Symptom**: Preview generation errors during enrichment.

```
❌ Failed to convert HEIC to JPG: IMG_5678.heic
   Error: sharp: Input buffer contains unsupported image format
```

**Cause**:

- Corrupted HEIC files
- Unsupported HEIC variant (e.g., multi-image sequences)
- Missing libheif codec

**Solution 1: Verify Sharp Installation**

```bash
# Reinstall sharp with native dependencies
pnpm remove sharp
pnpm add sharp --force

# Verify codec support
node -e "require('sharp')().metadata().then(console.log)"
```

**Solution 2: Convert Manually**

```bash
# Use macOS sips command
sips -s format jpeg IMG_5678.heic --out IMG_5678.jpg

# Or ImageMagick
convert IMG_5678.heic IMG_5678.jpg
```

**Solution 3: Skip Failed Conversions**

```bash
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --skip-failed-conversions \
  --log-conversion-errors ./conversion-errors.json
```

---

### Problem: Absolute vs Relative Paths

**Symptom**: Enrichment fails with "ENOENT: no such file or directory".

```
❌ Error: ENOENT: no such file or directory, open 'Attachments/IMG_1234.heic'
```

**Cause**: CSV exports contain relative paths, not absolute paths.

**Solution**: The pipeline enforces absolute paths:

```bash
# Path validator converts relative → absolute
imessage-timeline normalize-link \
  --input ingested.json \
  --output normalized.json \
  --attachment-roots ~/Library/Messages/Attachments

# Verifies all paths are absolute
# media.path = "/Users/you/Library/Messages/Attachments/aa/10/IMG_1234.heic"
```

**Manual verification**:

```bash
# Check for relative paths
jq '.messages[] | select(.messageKind == "media") | select(.media.path | startswith("/") | not)' normalized.json

# Should return no results
```

---

## Rate Limiting and API Errors

### Problem: 429 Too Many Requests (Gemini API)

**Symptom**: Enrichment stops with rate limit errors.

```
❌ Gemini API Error: 429 Too Many Requests
   Retry-After: 60 seconds
   Message: "Quota exceeded for quota metric 'Generate Content API requests per minute'"
```

**Cause**: Exceeded Gemini free tier limits (15 RPM).

**Solution 1: Increase Delay**

```bash
# Increase delay between requests to 4000ms (15 req/min)
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --rate-limit 4000
```

**Solution 2: Upgrade API Tier**

Free tier limits:

- **15 RPM** (requests per minute)
- **1500 RPD** (requests per day)
- **1 million TPM** (tokens per minute)

Upgrade to paid tier:

- Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
- Enable billing
- Increase to **60 RPM** or **360 RPM**

**Solution 3: Use Checkpoints**

```bash
# Let pipeline auto-resume after rate limit resets
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --checkpoint-interval 50 \
  --resume \
  --max-retries 5
```

The pipeline will:

1. Hit 429 error
2. Wait for `Retry-After` header duration (or exponential backoff)
3. Write checkpoint
4. Retry automatically

---

### Problem: Exponential Backoff Not Working

**Symptom**: Pipeline retries too quickly after 429 errors.

```
❌ Retry attempt 1/3 after 2s...
❌ Retry attempt 2/3 after 4s...
❌ Retry attempt 3/3 after 8s...
❌ Max retries exceeded
```

**Cause**: Exponential backoff formula:

```typescript
// Delay = 2^attempt seconds with ±25% jitter
const baseDelay = Math.pow(2, attemptNumber) * 1000 // ms
const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
const delay = baseDelay + jitter
```

**Solution**: Respect `Retry-After` header:

```bash
# The pipeline automatically detects Retry-After
# Check rate-limiting.ts logs:

✓ 429 response received
→ Retry-After header: 60 seconds
→ Waiting 60000ms before retry...
```

**Manual override**:

```typescript
// In your config
{
  "gemini": {
    "rateLimitDelay": 2000,
    "maxRetries": 5,
    "backoffMultiplier": 3 // 3^n instead of 2^n
  }
}
```

---

### Problem: Circuit Breaker Triggered

**Symptom**: Pipeline stops after consecutive failures.

```
❌ Circuit breaker OPEN after 5 consecutive failures
⏸  Halting enrichment to prevent cascading failures
   Wait 60s for circuit to reset, then resume with --resume
```

**Cause**: Circuit breaker prevents hammering failing APIs.

**Default thresholds**:

- **5 consecutive failures** → circuit opens
- **60 seconds** → circuit resets (half-open state)

**Solution 1: Wait for Reset**

```bash
# Wait 60 seconds, then resume
sleep 60
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --resume
```

**Solution 2: Adjust Threshold**

```bash
# Increase threshold to 10 failures
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --circuit-breaker-threshold 10 \
  --circuit-breaker-reset-ms 120000
```

**Solution 3: Check API Status**

```bash
# Verify Gemini API is operational
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models

# Check status page
open https://status.cloud.google.com/
```

---

### Problem: Firecrawl 503 Service Unavailable

**Symptom**: Link enrichment fails intermittently.

```
⚠ Firecrawl error: 503 Service Unavailable
→ Falling back to provider-specific parser (YouTube)
```

**Solution**: The pipeline has automatic fallbacks:

```
Firecrawl (primary)
  ↓ (fails)
YouTube Parser (if youtube.com URL)
  ↓ (fails)
Spotify Parser (if spotify.com URL)
  ↓ (fails)
Twitter Parser (if twitter.com/x.com URL)
  ↓ (fails)
Instagram Parser (if instagram.com URL)
  ↓ (fails)
Generic meta tag parser
```

**Disable Firecrawl**:

```bash
# Skip Firecrawl, use fallbacks only
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --enable-firecrawl false
```

---

## Checkpoint and Resume Failures

### Problem: "Config hash mismatch"

**Symptom**: Resume fails due to configuration change.

```
❌ Cannot resume: Config hash mismatch
   Checkpoint: a3b5c8d0e2f4a6b8
   Current:    f9e1c3b7d5a9c1e3

   Configuration has changed since checkpoint was created.
   Delete checkpoint and restart, or restore original config.
```

**Cause**: Configuration changed between runs (e.g., different API key, rate
limit settings).

**Config hash includes**:

- `geminiApiKey`
- `firecrawlApiKey`
- `rateLimitDelay`
- `enableVisionAnalysis`
- `enableAudioTranscription`
- `enableLinkEnrichment`
- `imageCacheDir`

**Solution 1: Delete Checkpoint**

```bash
# Remove checkpoint and start fresh
rm -f checkpoints/enrich-checkpoint-*.json
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json
```

**Solution 2: Restore Original Config**

```bash
# Find original config hash in checkpoint
jq '.configHash, .createdAt' checkpoints/enrich-checkpoint-500.json

# Restore config to match checkpoint
# (e.g., restore .env, imessage-config.json)
```

**Solution 3: Force Resume (DANGEROUS)**

```bash
# Override hash check (may cause inconsistent enrichments)
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --resume \
  --force-resume-ignore-config
```

⚠️ **Warning**: Force resuming with different config may cause:

- Duplicate enrichments with different models
- Missing enrichments if providers disabled
- Inconsistent rate limiting

---

### Problem: Checkpoint File Corrupted

**Symptom**: Resume fails with parse error.

```
❌ Failed to load checkpoint: checkpoints/enrich-checkpoint-300.json
   SyntaxError: Unexpected end of JSON input
```

**Cause**: Checkpoint write interrupted (Ctrl+C during write, disk full).

**Solution 1: Load Previous Checkpoint**

```bash
# List checkpoints
ls -lh checkpoints/enrich-checkpoint-*.json

# Use earlier checkpoint
cp checkpoints/enrich-checkpoint-200.json checkpoints/enrich-checkpoint-latest.json
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --resume
```

**Solution 2: Repair JSON**

```bash
# Check for truncation
tail -c 50 checkpoints/enrich-checkpoint-300.json

# Attempt repair with jq
jq '.' checkpoints/enrich-checkpoint-300.json

# If repair fails, delete and use previous checkpoint
```

**Solution 3: Start from Scratch**

```bash
# Remove all checkpoints
rm -rf checkpoints/
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --checkpoint-interval 25 # More frequent checkpoints
```

---

### Problem: Resume Skips Messages

**Symptom**: Resume starts at wrong index.

```
✓ Loaded checkpoint: last index 500
→ Resuming from index 501
⚠ But message 500 was not fully enriched!
```

**Cause**: Checkpoint written before enrichment completed.

**Resume guarantee**: The pipeline resumes **within ≤1 item** of checkpoint.

```typescript
// Resume logic (checkpoint.ts)
export function getResumeIndex(checkpoint: EnrichCheckpoint): number {
  // Resume at next item after last successfully processed
  return checkpoint.lastProcessedIndex + 1
}
```

**Solution**: Check failed items list:

```bash
# Inspect checkpoint for failed items
jq '.failedItems' checkpoints/enrich-checkpoint-500.json

# Example output:
# [
#   {
#     "index": 245,
#     "guid": "abc-123",
#     "kind": "image_analysis",
#     "error": "Gemini API timeout"
#   }
# ]

# Re-enrich failed items manually
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --force-refresh \
  --only-guids abc-123,def-456
```

---

### Problem: Checkpoint Writes Too Frequently

**Symptom**: Enrichment slow due to frequent checkpoint writes.

```
✓ Checkpoint written: enrich-checkpoint-10.json (2.1 MB)
✓ Checkpoint written: enrich-checkpoint-20.json (4.2 MB)
✓ Checkpoint written: enrich-checkpoint-30.json (6.3 MB)
...
⏱  Total time: 3h 45m (expected 45m for 1000 messages)
```

**Cause**: Checkpoint interval too small (default 100).

**Solution**: Increase interval:

```bash
# Write checkpoint every 500 items instead of 100
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --checkpoint-interval 500
```

**Tradeoffs**:

- **Smaller interval** (10-50): More frequent backups, slower performance
- **Larger interval** (500-1000): Faster performance, lose more progress on
  failure
- **Recommended**: 100 items (default) balances speed and safety

---

## Validation Errors

### Problem: "messageKind='media' but media field missing"

**Symptom**: Schema validation fails.

```
❌ Validation failed: Message abc-123
   - superRefine: messageKind='media' requires media field
```

**Cause**: CSV row classified as media but attachment path missing.

**Solution**: Check CSV row:

```bash
# Find problematic message
jq '.messages[] | select(.guid == "abc-123")' ingested.json

# Example:
# {
#   "guid": "abc-123",
#   "messageKind": "media",  ← Classified as media
#   "media": null            ← But media field is null!
# }
```

**Fix**: Re-ingest with strict validation:

```bash
imessage-timeline ingest-csv \
  --input messages.csv \
  --output ingested.json \
  --strict-media-validation \
  --log-invalid ./invalid-rows.json
```

---

### Problem: "Invalid GUID format"

**Symptom**: GUID validation fails.

```
❌ Validation error: guid must match pattern
   guid: "invalid guid"
   Expected: non-empty string
```

**Cause**: Malformed GUID in source data.

**Valid GUID formats**:

- CSV: `csv:<rowNumber>:<partIndex>` (e.g., `csv:123:0`)
- DB: `<UUID>` (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Part: `p:<index>/<parentGuid>` (e.g., `p:1/abc-123`)

**Solution**: Regenerate GUIDs:

```bash
# Regenerate GUIDs during ingest
imessage-timeline ingest-csv \
  --input messages.csv \
  --output ingested.json \
  --regenerate-guids
```

---

### Problem: "Enrichment kind already exists"

**Symptom**: Idempotency check prevents enrichment.

```
⏭  Skipping image_analysis for media-456: already enriched
```

**Cause**: Re-running enrichment without `--force-refresh`.

**Solution 1: Normal Behavior**

This is **expected** behavior (idempotency). Re-running won't duplicate
enrichments.

**Solution 2: Force Re-enrichment**

```bash
# Re-enrich all messages (overwrites existing)
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --force-refresh
```

**Solution 3: Clear Specific Enrichments**

```typescript
// Clear only image_analysis, keep others
import { clearEnrichmentByKind } from 'imessage-timeline'

for (const msg of messages) {
  if (msg.messageKind === 'media') {
    msg.media.enrichment = clearEnrichmentByKind(
      msg.media.enrichment,
      'image_analysis',
    )
  }
}
```

---

### Problem: camelCase vs snake_case Field Names

**Symptom**: Validation rejects snake_case fields.

```
❌ Validation error: Unexpected field 'message_date'
   Use camelCase: 'messageDate'
```

**Cause**: CSV export uses snake_case (e.g., `message_date`), schema requires
camelCase.

**Solution**: The ingest stage auto-converts:

```typescript
// ingest-csv.ts mapping
const mapping = {
  'Message Date': 'date', // CSV → camelCase
  'Delivered Date': 'dateDelivered',
  'Read Date': 'dateRead',
  'Is From Me': 'isFromMe',
  // ...
}
```

**Verify conversion**:

```bash
# Check for snake_case fields
jq 'keys' ingested.json | grep "_"

# Should return no results (all camelCase)
```

---

## Performance Issues

### Problem: Enrichment Takes Too Long

**Symptom**: Processing 1000 messages takes >2 hours.

**Expected performance**:

- **Ingest CSV**: ~500 messages/second
- **Normalize-Link**: ~1000 messages/second
- **Enrich-AI**: ~2 messages/second (limited by API rate)
- **Render**: ~5000 messages/second

**Solutions**:

**1. Reduce Rate Limit Delay**

```bash
# Default 1000ms → change to 500ms
imessage-timeline enrich-ai \
  --rate-limit 500
```

⚠️ **Warning**: May trigger 429 errors if too aggressive.

**2. Skip Certain Enrichments**

```bash
# Skip audio transcription (slow)
imessage-timeline enrich-ai \
  --enable-audio false
```

**3. Parallel Processing**

```bash
# Split messages into batches
jq '.messages[0:500]' normalized.json > batch1.json
jq '.messages[500:1000]' normalized.json > batch2.json

# Run in parallel
imessage-timeline enrich-ai --input batch1.json --output enriched1.json &
imessage-timeline enrich-ai --input batch2.json --output enriched2.json &
wait

# Merge results
jq -s '.[0].messages + .[1].messages | {messages: .}' enriched1.json enriched2.json > enriched.json
```

---

### Problem: High Memory Usage

**Symptom**: Node.js crashes with OOM (out of memory).

```
<--- Last few GCs --->
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Cause**: Loading entire message JSON into memory.

**Solution**: Increase Node heap size:

```bash
# Increase to 4GB
NODE_OPTIONS="--max-old-space-size=4096" \
  imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json
```

**Streaming mode** (future enhancement):

```bash
# Process in chunks
imessage-timeline enrich-ai \
  --input normalized.json \
  --output enriched.json \
  --streaming \
  --chunk-size 100
```

---

## Common Error Messages

### Error: "EACCES: permission denied"

```
❌ Error: EACCES: permission denied, open '/Users/you/Library/Messages/chat.db'
```

**Fix**: Grant Full Disk Access on macOS:

1. System Preferences → Security & Privacy → Privacy
2. Full Disk Access → Add Terminal or your app
3. Restart Terminal

---

### Error: "Cannot find module 'sharp'"

```
❌ Error: Cannot find module 'sharp'
```

**Fix**:

```bash
pnpm install sharp --force
```

---

### Error: "Invalid API key"

```
❌ Gemini API Error: 401 Unauthorized
   Invalid API key
```

**Fix**:

```bash
# Verify API key is set
echo $GEMINI_API_KEY

# Re-export if needed
export GEMINI_API_KEY="AIzaSy..."

# Or update .env
echo "GEMINI_API_KEY=AIzaSy..." >> .env
```

---

### Error: "No messages found in input"

```
❌ Error: No messages found in input file
   File: ingested.json
```

**Fix**: Check JSON structure:

```bash
# Verify envelope format
jq '.messages | length' ingested.json

# Should return number (e.g., 1234)
# Not: null or error
```

---

## Getting Help

If you encounter an error not covered here:

1. **Enable verbose logging**:

   ```bash
   imessage-timeline enrich-ai \
     --input normalized.json \
     --output enriched.json \
     --verbose \
     --log-file debug.log
   ```

2. **Check logs**:

   ```bash
   tail -f debug.log
   ```

3. **File an issue** with:
   - Error message (full stack trace)
   - Command run
   - Input file sample (first 10 messages)
   - Environment (Node version, OS, pnpm version)

---

## Related Documentation

- **[Usage Guide](./imessage-pipeline-usage.md)** - How to run the pipeline
- **[Technical Specification](./imessage-pipeline-tech-spec.md)** - Architecture
  details
- **[Implementation Summary](./imessage-pipeline-implementation-summary.md)** -
  File structure

---

**Document Version**: 1.0 **Author**: Generated from iMessage Pipeline
implementation **Last Updated**: 2025-10-19
