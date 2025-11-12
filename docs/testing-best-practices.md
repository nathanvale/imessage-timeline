# Testing best practices (Vitest + Testing Library + Wallaby)

This project uses Vitest for unit/integration tests with a jsdom environment,
plus optional Wallaby for fast, in-editor feedback. This guide captures the
rationale behind our config and the patterns we use to keep tests reliable,
readable, and fast.

## Determinism and order

- Shuffle test execution to uncover hidden state coupling
  - Enabled via `test.sequence.shuffle = true`
- Use a stable seed in CI for reproducible runs
  - `test.sequence.seed = 20251111` when `TF_BUILD` is set
- Prefer isolated tests; avoid reliance on execution order

### Deterministic date handling (UTC)

- Treat timezone-less ISO strings as UTC and append `Z` before parsing
  - Canonicalize with `new Date(iso).toISOString()` to normalize output
- Use UTC getters (`getUTCHours`, `getUTCFullYear`, etc.) consistently
- Prefer lexicographic sorting for date-only keys (`YYYY-MM-DD`) to avoid
  environment-dependent parsing
- Enforce `process.env.TZ = 'UTC'` in `tests/vitest/vitest-setup.ts`

References: Vitest sequence docs (shuffle/seed), reporters and CI usage.

## Isolation and hygiene

- No globals: `test.globals = false`; import what you use
- Global setup (`tests/vitest/vitest-setup.ts`):
  - `vi.resetAllMocks()`, `vi.clearAllMocks()` in `beforeEach`
  - `vi.useRealTimers()` to avoid timer leakage
  - Register matchers with Vitest-friendly import:
    - `import '@testing-library/jest-dom/vitest'`
  - Raise listener limit to avoid EventEmitter warnings in parallel runs:
    - `process.setMaxListeners(64)`
- Prefer module-level pure helpers over process-level shared state

References: jest-dom “With Vitest” usage notes.

## Async UI assertions (if/when testing React)

- Use `screen` queries from Testing Library
- Prefer `findBy*` (auto-retrying) for async UI instead of manual timeouts
- Use `waitFor(...)` to wrap stateful async updates when needed
- Prefer `userEvent` over `fireEvent` for realistic interactions
- Query by role/name first; fall back to `getByTestId` only when necessary

References: React Testing Library cheatsheet (queries, async, events).

## Coverage policy

- Provider: `v8`
- Thresholds (global + per-file):
  - branches: 75
  - lines/functions/statements: 80
- Reports:
  - Local: `html` + `text-summary` → `./coverage`
  - CI: `html`, `lcov`, `text-summary` → `./test-results/coverage`
- Exclusions: type defs, test files, build outputs, config files

References: Vitest coverage config and reporters.

## CI behavior

- Reporters: `default` locally; `['junit', 'default']` in CI
  - JUnit output: `./test-results/junit.xml`
- Concurrency: threads pool, capped at 8 workers
- Determinism: stable seed and `allowOnly = false`
- Retries: enabled only in CI (`retry = 2`) for transient flake

References: Vitest reporters, sequence, retries.

## jsdom environment notes

- No real layout/rendering; APIs like `getBoundingClientRect()` may be zeroed
- Use role/name-based queries; avoid layout expectations
- If you need `requestAnimationFrame`, jsdom can simulate it; but we avoid
  enabling `pretendToBeVisual` to keep runs lean
- Avoid global window mutation; prefer dependency injection

References: jsdom README (caveats, pretendToBeVisual, executing scripts).

## Wallaby tips (optional local TDD)

Wallaby auto-detects Vitest config. If you add a manual config, prefer:

- `autoDetect: ['vitest']` (or leave auto detection on)
- Keep workers small while starting (`workers: 1–2`) if you see flake
- If transient issues occur, try `workers.restart = true`
- Exclude large folders from instrumentation (dist, coverage, caches)
- Use the Wallaby Troubleshooting guide for stuck cache or core updates

References: Wallaby overview, auto-detect, workers, troubleshooting.

## Quick checklist

- [ ] Use `screen` queries; prefer `findBy*` for async
- [ ] Reset/clear mocks and real timers in `beforeEach`
- [ ] Avoid global state and implicit test ordering
- [ ] Don’t assert on DOM structure; assert on behavior and accessible roles
- [ ] Keep coverage thresholds green; raise on critical paths when feasible
- [ ] In CI, keep runs reproducible (seed, junit, capped threads)

---

Further reading:

- React Testing Library: queries, async, and patterns
- @testing-library/jest-dom: matchers and Vitest setup
- jsdom: environment options, limitations, and safety
- Wallaby: configuration, workers, and troubleshooting
