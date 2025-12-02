# iMessage Timeline

Extract, transform, and analyze iMessage conversations with AI-powered enrichment and timeline rendering.

---

## CRITICAL RULES

**YOU MUST** follow these rules when working on this project:

### NEVER Do These

- **NEVER delete or remove untracked git changes** — Catastrophic data loss
- **NEVER modify files in `src/legacy/` if present** — Deprecated code, leave untouched
- **NEVER create nested biome.json files** — Single root config only, use overrides
- **NEVER skip tests for critical pipeline stages** — Enrichment, deduplication, linking require tests
- **NEVER commit without running quality checks** — Hooks validate, but double-check manually
- **NEVER use destructive git commands** — No `reset --hard`, `clean -f`, `push --force` without explicit approval
- **NEVER modify GitHub Actions workflows without testing locally** — Use `actionlint` first

### ALWAYS Do These

1. **Read files before editing** — Understand existing patterns
2. **Run tests after changes** — `bun test` or use MCP `bun_runTests` tool
3. **Use Biome for formatting** — Auto-fixes on save via hooks
4. **Follow conventional commits** — `type(scope): subject` format
5. **Add JSDoc to exported functions** — Document the "why", not just the "what"
6. **Preserve determinism** — No randomization, stable sorting, reproducible outputs
7. **Handle errors gracefully** — Never crash pipeline, log and continue with partial data

---

## Project Context

### Overview

**iMessage Timeline** is a sophisticated data pipeline that transforms iMessage conversations into searchable, enriched markdown timelines. It extracts messages from multiple sources (iMazing CSV, macOS Messages.app database), deduplicates and links replies/reactions, enriches with AI-powered analysis (image captions, audio transcription, link summaries), and generates deterministic markdown files.

### Tech Stack

- **Language**: TypeScript 5.9+ (strict mode)
- **Runtime**: Bun (dev/tooling) + Node.js 22+ (CI/production)
- **Test Framework**: Bun test runner (Vitest-compatible API, colocated `*.test.ts` files)
- **Linter/Formatter**: Biome 2.3.7
- **Package Manager**: Bun (primary), pnpm (legacy CI support)
- **Build Tool**: bunup (TypeScript → ESM dist)
- **CLI Framework**: Commander.js
- **Schema Validation**: Zod
- **AI Services**: Google Gemini (vision/audio), Firecrawl (links)
- **Docs Site**: Docusaurus

### Architecture

4-stage pipeline with clear separation of concerns:

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

---

## Directory Structure

```
imessage-timeline/
├── src/
│   ├── cli.ts                 # Main CLI entry point (66k LOC, complex)
│   ├── index.ts               # Library exports for programmatic use
│   ├── cli/                   # CLI commands and utilities
│   │   ├── commands/          # Individual CLI commands (10 commands)
│   │   ├── types.ts           # CLI-specific types
│   │   └── utils.ts           # CLI helpers
│   ├── config/                # Configuration management
│   │   ├── schema.ts          # Zod schemas for config validation
│   │   ├── loader.ts          # YAML/JSON config loading
│   │   └── generator.ts       # Config file generation
│   ├── ingest/                # Stage 1: Data ingestion
│   │   ├── ingest-csv.ts      # iMazing CSV parser
│   │   ├── ingest-db.ts       # Messages.app SQLite extractor
│   │   ├── dedup-merge.ts     # Cross-source deduplication
│   │   └── link-replies-and-tapbacks.ts  # Reply/reaction linking
│   ├── normalize/             # Date/path normalization utilities
│   │   ├── date-converters.ts # Apple epoch → ISO 8601 conversion
│   │   ├── path-validator.ts  # Attachment path resolution
│   │   └── validate-normalized.ts  # Schema validation
│   ├── enrich/                # Stage 3: AI enrichment
│   │   ├── image-analysis.ts  # Gemini Vision API integration
│   │   ├── audio-transcription.ts  # Audio → text with timestamps
│   │   ├── link-enrichment.ts # Link context extraction
│   │   ├── pdf-video-handling.ts  # PDF/video processing
│   │   ├── checkpoint.ts      # Crash recovery & resume
│   │   ├── idempotency.ts     # Skip already-enriched items
│   │   ├── rate-limiting.ts   # API throttling with backoff
│   │   ├── progress-tracker.ts  # Enrichment progress UI
│   │   └── providers/         # Link enrichment providers
│   │       ├── firecrawl.ts   # Firecrawl API (primary)
│   │       ├── youtube.ts     # YouTube fallback
│   │       ├── spotify.ts     # Spotify metadata
│   │       └── generic.ts     # HTML meta tag scraper
│   ├── render/                # Stage 4: Markdown generation
│   │   ├── index.ts           # Main renderer
│   │   ├── grouping.ts        # Date/time-of-day grouping
│   │   ├── reply-rendering.ts # Nested blockquote threading
│   │   └── embeds-blockquotes.ts  # Enrichment formatting
│   ├── schema/                # Zod schemas for messages
│   │   └── message.ts         # Unified Message type (14k LOC)
│   ├── utils/                 # Shared utilities
│   │   ├── logger.ts          # Pino-based logging
│   │   ├── delta-detection.ts # Incremental processing
│   │   ├── enrichment-merge.ts  # Merge enrichments into dataset
│   │   └── incremental-state.ts  # State management for --incremental
│   ├── progress/              # Progress reporting
│   │   ├── progress-manager.ts  # CLI progress bars
│   │   └── pipeline-progress.ts  # Pipeline status tracking
│   └── __tests__/             # Top-level tests
├── tests/
│   └── helpers/               # Shared test utilities
│       ├── test-data-builders.ts  # Factory functions for test data
│       ├── schema-assertions.ts   # Zod validation helpers
│       ├── fixture-loaders.ts     # Load test fixtures
│       └── mock-providers.ts      # Mock Gemini/Firecrawl APIs
├── __tests__/
│   └── fixtures/              # Shared test data (valid/invalid messages)
├── docs/                      # Technical documentation (25+ docs)
│   ├── cli-usage.md           # CLI reference
│   ├── automated-release-workflow.md  # Changesets flow
│   ├── pre-release-guide.md   # Beta/RC/canary releases
│   ├── testing-best-practices.md  # Test patterns
│   ├── bun-script-best-practices.md  # Bun usage rationale
│   └── releases/              # Release documentation
├── examples/                  # Sample config files
│   ├── imessage-config.yaml   # Full config example
│   └── imessage-config-minimal.yaml  # Minimal setup
├── scripts/                   # Utility scripts
│   ├── validate-json.ts       # JSON schema validator
│   └── setup-branch-protection.sh  # GitHub branch protection
├── .github/
│   ├── workflows/             # 17 CI/CD workflows
│   │   ├── pr-quality.yml     # Lint, test, coverage on PRs
│   │   ├── changesets-manage-publish.yml  # Auto-release workflow
│   │   ├── pre-mode.yml       # Pre-release mode management
│   │   ├── codeql.yml         # Security scanning
│   │   ├── security.yml       # OSV Scanner for vulnerabilities
│   │   └── deploy-docs.yml    # GitHub Pages docs deployment
│   ├── actions/               # Reusable composite actions
│   │   ├── setup-bun/         # Bun installation + caching
│   │   ├── setup-pnpm/        # pnpm fallback setup
│   │   └── coverage-comment/  # Post coverage to PR comments
│   └── scripts/               # Workflow helper scripts
│       ├── changesets-publish.sh  # Publish with provenance
│       └── pre-mode-toggle.sh     # Enter/exit pre-release mode
├── website/                   # Docusaurus documentation site
│   ├── docs/                  # Markdown docs (synced from /docs)
│   └── docusaurus.config.ts   # Site configuration
├── .changeset/                # Changesets for versioning
│   ├── config.json            # Changeset configuration
│   └── pre.json               # Pre-release mode state
├── .husky/                    # Git hooks
│   ├── pre-commit             # Biome format + lint-staged
│   ├── commit-msg             # Commitlint validation
│   └── pre-push               # Block pushes to main/master
├── biome.json                 # Biome configuration (root only)
├── tsconfig.json              # TypeScript config for build
├── tsconfig.base.json         # Shared TypeScript settings
├── tsconfig.eslint.json       # TypeScript for linting
├── bunup.config.ts            # Bunup build configuration
├── package.json               # Dependencies + scripts
├── .env.example               # Required environment variables
└── README.md                  # User documentation
```

---

## Key Commands

### Development

```bash
# Install dependencies
bun install

# Run CLI from TypeScript (fast dev loop)
bun dev -- --help
bun dev -- doctor

# Build TypeScript → dist/
bun run build

# Run built CLI
bun cli -- --help
node ./dist/bin/index.js --help

# Watch mode (auto-rebuild on changes)
bun run watch:types
```

### Testing

```bash
# Run all tests
bun test

# Watch mode
bun test:watch

# Coverage report
bun coverage

# CI mode (with JUnit reporter)
bun test:ci

# Run specific test file (via MCP tool)
bun_testFile({ file: "src/config/loader.test.ts" })
```

### Code Quality

```bash
# Lint + format check (read-only)
bun run lint
bun run format:check

# Auto-fix issues
bun run lint:fix
bun run format

# Type checking
bun run typecheck

# Full quality check (pre-commit)
bun run quality-check:ci

# Package hygiene (publint + attw)
bun run hygiene
```

### Release Management

```bash
# Create changeset (user-facing changes)
bun run version:gen

# Enter pre-release mode (beta/rc/next)
bun run pre:enter:beta
bun run pre:enter:rc

# Exit pre-release mode
bun run pre:exit

# Publish (manual, CI does this automatically)
bun run release
```

### Pipeline Commands (via CLI)

```bash
# Initialize config
bun cli init

# System diagnostics
bun cli doctor

# Ingest from CSV
bun cli ingest-csv -i messages.csv -o messages.csv.ingested.json

# Ingest from database
bun cli ingest-db -i ~/Library/Messages/chat.db -o messages.db.ingested.json

# Normalize and link
bun cli normalize-link -i messages.csv.ingested.json messages.db.ingested.json -o messages.normalized.json

# Enrich with AI (resumable, incremental)
bun cli enrich-ai -i messages.normalized.json -o messages.enriched.json --resume --incremental

# Render to markdown
bun cli render-markdown -i messages.enriched.json -o ./timeline

# Validate JSON
bun cli validate -i messages.json

# Show stats
bun cli stats -i messages.json
```

---

## Code Conventions

### TypeScript Style

- **Strict mode enabled**: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`
- **Module system**: ESM only (`"type": "module"`)
- **Path aliases**: Use `#enrich/*`, `#ingest/*`, etc. (defined in package.json `imports`)
- **No `any` types**: Use `unknown` + type narrowing
- **Arrow functions in tests**: `it('should do X', () => { ... })`

### File Naming

- **Source files**: `kebab-case.ts` (e.g., `delta-detection.ts`)
- **Test files**: Colocated with source as `*.test.ts` (e.g., `delta-detection.test.ts`)
- **Exports**: Named exports preferred over default exports

### Documentation

Every exported function requires JSDoc:

```typescript
/**
 * Detects new, changed, and removed messages between two datasets.
 * @param current - Current message dataset
 * @param previous - Previous message dataset
 * @returns Delta with new/changed/removed GUIDs
 */
export function detectDelta(current: Message[], previous: Message[]): DeltaResult {
  // ...
}
```

### Import Organization (Biome)

Biome automatically organizes imports in this order:
1. Node.js built-ins (`node:fs`, `node:path`)
2. External packages (`zod`, `commander`)
3. Local imports (`#utils/*`, `./schema.js`)

### Formatting (Biome)

- **Indentation**: Tabs (width: 2)
- **Line width**: 80 characters (100 for tests)
- **Quotes**: Single quotes
- **Semicolons**: Optional (ASI)
- **Trailing commas**: Always

---

## Git Workflow

### Branch Naming

**Pattern**: `type/description`

Examples:
- `feat/add-video-enrichment`
- `fix/checkpoint-race-condition`
- `ci/migrate-to-bun`
- `docs/update-cli-usage`
- `chore/upgrade-biome`

### Commit Format (Conventional Commits)

**Format**: `type(scope): subject`

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Examples**:
```
feat(enrich): add video transcription support
fix(checkpoint): prevent race condition in state file writes
docs(readme): clarify incremental mode usage
ci(workflows): migrate from pnpm to Bun
chore(deps): upgrade Biome to v2.3.7
```

**Rules**:
- Max 100 characters
- Lowercase subject
- No period at end
- Imperative mood ("add" not "added")

### PR Workflow

1. Create feature branch from `main`
2. Make changes, commit with conventional format
3. Push and create PR
4. CI runs: lint, typecheck, tests, coverage
5. Hooks validate: commitlint, Biome formatting
6. Squash merge to `main` (PR title becomes commit message)
7. Changesets workflow creates "Version Packages" PR
8. Auto-merge when checks pass → publish to npm

### Protected Branches

- **main**: Requires PR, passing checks, no force push
- **Checks required**: PR quality, commitlint, PR title lint

---

## Testing Strategy

### Test Patterns

- **Colocated tests**: `src/foo.ts` → `src/__tests__/foo.test.ts`
- **Shared fixtures**: `__tests__/fixtures/` and `tests/helpers/`
- **Test data builders**: Use factory functions from `tests/helpers/test-data-builders.ts`
- **Arrow notation**: `it('should calculate total', () => { ... })`

### Coverage Goals

- **Overall**: 70%+ branch coverage
- **Critical paths**: 95%+ (linking, dedup, enrichment)

### Test Helpers Available

```typescript
// From tests/helpers/test-data-builders.ts
import { buildMessage, buildMediaMessage, buildTapback } from 'tests/helpers'

// From tests/helpers/schema-assertions.ts
import { assertValidMessage, assertInvalidMessage } from 'tests/helpers'

// From tests/helpers/mock-providers.ts
import { mockGeminiAPI, mockFirecrawlAPI } from 'tests/helpers'
```

### Running Tests

**Prefer MCP tools over direct CLI:**

```typescript
// Check all tests
bun_runTests({ })

// Run specific file
bun_testFile({ file: "src/config/loader.test.ts" })

// Coverage summary
bun_testCoverage({ })
```

---

## Environment Variables

Required for AI enrichment:

```bash
# .env or shell export
GEMINI_API_KEY=your-api-key-here        # Required for image/audio enrichment
FIRECRAWL_API_KEY=your-api-key-here     # Optional, for link enrichment
```

Get API keys:
- Gemini: https://aistudio.google.com
- Firecrawl: https://www.firecrawl.dev

---

## CI/CD Workflows

### On PR (pr-quality.yml)

- Biome lint + format check
- TypeScript type checking
- Full test suite with V8 coverage
- Coverage delta check (fail if coverage decreases)
- JUnit test reporter (Azure Pipelines format)

### On Main Push (changesets-manage-publish.yml)

- Creates "Version Packages" PR with changelog
- Auto-merges when checks pass
- Publishes to npm with provenance
- Creates GitHub Release with SBOM

### Security Scanning

- **CodeQL**: Static analysis (JS/TS vulnerabilities)
- **OSV Scanner**: Dependency vulnerability scanning
- **Dependency Review**: Flags risky PR dependency changes

### Pre-release Channels

- **next**: Early adopters (`0.0.1-next.0`)
- **beta**: Feature-complete testing (`0.0.1-beta.1`)
- **rc**: Release candidates (`0.0.1-rc.0`)
- **alpha**: Nightly snapshots (auto-published in pre-mode)
- **canary**: Manual snapshots (only when NOT in pre-mode)

---

## Special Rules & Gotchas

### Determinism is Critical

**All outputs must be reproducible**:
- Sort messages by `(date, guid)` before rendering
- No `Math.random()`, no `Date.now()` in output
- Stable JSON key ordering
- Identical input → identical markdown files

**Why**: Allows diffing timelines, verifying enrichment correctness, reproducible builds.

### Idempotency in Enrichment

**Never re-enrich already-enriched items**:
- Check if `enrichment.kind` exists before enriching
- Use `--force-refresh` to override (but never by default)
- Checkpoint hash verification ensures config consistency

**Why**: Saves API costs, prevents duplicate enrichments.

### Path Alias Imports

**Use path aliases** defined in `package.json`:

```typescript
// Good
import { Message } from '#schema/message.js'
import { logger } from '#utils/logger.js'

// Bad
import { Message } from '../../schema/message.js'
```

**Why**: Cleaner imports, easier refactoring, matches TypeScript paths.

### Test Isolation

**CI has strict test isolation**:
- Tests run with UUID temp directories
- Config tests skipped in CI (`CI=true` check)
- Mock cleanup after each test

**Why**: Prevents parallel test collisions, flaky tests.

### Changesets Required

**All user-facing changes need a changeset**:

```bash
bun run version:gen
# Select: patch/minor/major
# Describe: What changed and why
```

**Exception**: Internal refactors, docs-only changes, CI tweaks (use `chore:` commits).

**Why**: Automated changelog generation, semantic versioning.

### Hooks Auto-run

**Git hooks validate everything**:
- `pre-commit`: Biome format + lint-staged
- `commit-msg`: Commitlint (conventional commits)
- `pre-push`: Block pushes to main/master

**You'll see errors if**:
- Commit message doesn't follow conventional format
- Code isn't Biome-formatted
- Attempting to push to protected branch

**Fix**: Follow error messages, hooks prevent bad commits.

---

## Notes

### Migration to Bun Stack (feat/bun-stack-migration)

**Current branch** is migrating from pnpm to Bun:
- Build: `bunx bunup` (TypeScript → ESM)
- Tests: Bun's built-in test runner (Vitest-compatible API for type safety)
- Dev: `bun dev` for fast TS execution
- CI: Migrated workflows to Bun (see commit `8286e8d`)

**Why Bun?**
- 10x faster `bun dev` (no compilation)
- Native TypeScript support
- Built-in test runner (faster than Vitest)
- Compatible with Firecrawl SDK
- All-in-one toolchain (runtime + test + bundler)

### Dual-Mode Distribution

**This package is both**:
- **CLI**: `imessage-timeline` executable
- **Library**: Programmatic API for Node.js/Bun projects

**See**: `docs/dual-mode-distribution-best-practices.md` for packaging details.

### Known Limitations

- **macOS required** for database ingestion (Messages.app access)
- **CSV ingestion** works on any OS
- **Large conversations** (100k+ messages) may need chunked enrichment
- **Rate limits**: Gemini free tier ~15 req/min, use `--rate-limit 5000` for safety

### Documentation Site

**Live docs**: https://nathanvale.github.io/imessage-timeline/

**Local development**:
```bash
bun run docs:dev    # Start dev server (port 3000)
bun run docs:build  # Production build
bun run docs:serve  # Serve production build
```

---

## Source References

- Main README: @./README.md
- CLI Usage: @./docs/cli-usage.md
- Testing Best Practices: @./docs/testing-best-practices.md
- Release Workflow: @./docs/automated-release-workflow.md
- Pre-Release Guide: @./docs/pre-release-guide.md
- Bun Script Rationale: @./docs/bun-script-best-practices.md
- Package Hygiene: @./docs/package-hygiene.md
- Branch Protection: @./docs/branch-protection-policy.md

---

**Generated**: 2025-12-02 via `/claude-code-claude-md:init`
**Auto-detected**: Directory structure (383 files), Tech stack (Bun/Vitest/Biome), Git patterns (conventional commits), Commands (30+ scripts)
