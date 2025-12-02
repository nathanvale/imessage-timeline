# Repository Guidelines

## Project Structure & Module Organization
- Core TypeScript source lives in `src/` (pipelines, normalization, enrichment, rendering). The CLI entrypoint is `src/cli/index.ts` and bundles to `dist/bin/index.js` via Bunup.
- Tests sit beside code under `src/**/__tests__` plus shared fixtures in `tests/helpers/` (fixtures, builders, mocks) and snapshots in `src/render/__tests__/__snapshots__/`.
- Generated artifacts land in `dist/`; docs and the website live under `docs/` and `website/` (workspace).
- Path aliases mirror the domain areas (e.g., `#ingest/*`, `#enrich/*`, `#render/*`) and are defined in `package.json`.

## Build, Test, and Development Commands
- `bun run dev` — run the CLI entry directly from source (fast feedback).
- `bun run cli` — execute the built CLI bundle at `dist/bin/index.js` (after `build`).
- `bun run build` — bundle library + CLI with Bunup into `dist/`.
- `bun run test` / `bun run test:ci` — run the test suite recursively (CI sets `TF_BUILD=true`); `bun run test:coverage` or `bun run coverage` gathers coverage.
- `bun run lint` / `bun run format` — Biome linting and formatting; `bun run typecheck` runs TypeScript.
- `bun run validate` — convenience pipeline: lint → typecheck → build → tests (CI-mode).

## Coding Style & Naming Conventions
- TypeScript + ESM; prefer named exports and domain-oriented modules (`ingest`, `normalize`, `enrich`, `render`).
- Biome enforces formatting (2-space indent) and lint rules; run `bun run format` before committing.
- Tests follow `*.test.ts` naming and colocate with implementation; snapshots live under `__snapshots__`.
- Use the established path aliases instead of relative `../../../` chains.

## Testing Guidelines
- Tests use the Vitest API; keep imports from `vitest` consistent.
- Aim to maintain coverage when adding code; use `bun run test:coverage` locally.
- Reuse fixtures/builders in `tests/helpers/` and prefer deterministic data (UTC dates where relevant).
- For CLI behavior, add smoke coverage via `tests/smoke-test-scripts.sh` when changing commands.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, etc.); commitlint enforces this.
- PRs should include: a concise summary of the change, linked issue (if any), testing performed (commands run), and screenshots/output for user-facing changes.
- Keep diffs focused; update docs when interfaces, flags, or CLI output change.
