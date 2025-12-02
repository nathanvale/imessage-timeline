# Bun script best practices (CLI-focused)

This repository ships a TypeScript CLI (`chatline`). We leverage Bun
for local development convenience and faster tooling, while retaining Node +
Vitest for testing and release stability.

## Goals

- Keep publishing/consumption standard: `bin` points to `dist/cli.js`.
- Use Bun for local dev (run TS directly) and for tooling (tsc/eslint/prettier).
- Keep tests on Node/Vitest to match CI and avoid environment drift.
- Continue using pnpm as the package manager.

## What changed

- Dev runs the CLI straight from TypeScript via Bun: `pnpm dev` →
  `bun src/cli.ts`.
- `tsc`, `eslint`, and `prettier` are invoked through `bunx` for speed.
- Tests stay on Node/Vitest (`pnpm vitest ...`).

## Scripts (authoritative)

- build: `bunx --bun tsc -p tsconfig.json`
- dev: `bun src/cli.ts`
- watch: `bunx --bun tsc -p tsconfig.json --watch`
- lint: `bunx --bun eslint .`
- lint:fix: `bunx --bun eslint . --fix`
- format: `bunx --bun prettier -w .`
- typecheck: `bunx --bun tsc -p tsconfig.eslint.json --noEmit`
- validate:json: `bun scripts/validate-json.ts`
- test: `vitest run` (Node)

Notes:

- `bin` remains `./dist/cli.js` for published usage. Dev uses Bun to avoid a
  build step when iterating locally.
- `tsconfig.json` stays strict for production builds. `tsconfig.eslint.json`
  powers fast no-emit type checking for lint/type safety (tests excluded).

## CLI development vs. publish

- Development:
  - Run: `pnpm dev -- --help` (args after `--` are forwarded to the CLI)
  - Build: `pnpm build` → emits `dist/**`
  - Local dist run: `pnpm cli -- --help`
- Publish consumers:
  - Use the installed command `chatline` (resolves to `dist/cli.js`).

## Testing and CI

- Continue to use Vitest on Node:
  - Local: `pnpm test`, `pnpm test:watch`
  - CI: `pnpm test:ci` with JUnit/coverage reporters (see `vitest.config.ts`)
- Coverage uses V8 and thresholds configured in `vitest.config.ts`.

## Rationale

- Bun offers very fast startup and excellent TypeScript support for dev loops.
- Keeping tests on Node avoids cross-runtime inconsistencies and keeps CI
  deterministic.
- `bunx` provides a drop-in way to run tool CLIs without changing the package
  manager (`pnpm` remains primary).

## Tips

- Forward CLI args in dev with `--`, e.g.:
  - `pnpm dev -- --config examples/imessage-config.yaml`
- If you don't have Bun installed locally, install it from https://bun.sh.
