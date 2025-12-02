# Repository Guidelines

## Project Structure & Modules
- `src/` holds the Bun/TypeScript CLI source; `src/cli.ts` is the entry.  
- Build artifacts land in `dist/` (CLI bundle at `dist/bin/index.js`, types at `dist/index.d.ts`).  
- Tests live alongside code in `src/__tests__/`; fixtures go in `src/__fixtures__/`.  
- Docs live in `website/`; automation and release logic sit in `.github/` and `.changeset/`.

## Build, Test, and Development Commands
- `bun run build` — bundle the CLI with bunup into `dist/`.  
- `bun run dev` — run the CLI from source for fast iteration.  
- `bun run start` — run the built CLI (`dist/bin/index.js`).  
- `bun test` / `bun test --coverage` — run the Vitest suite (recursive by default).  
- `bun run lint`, `bun run format`, `bun run typecheck` — static checks (Biome + TypeScript).  
- `bun run validate` — lint + typecheck + build + tests, mirroring CI.

## Coding Style & Naming
- TypeScript + ESM only; prefer explicit exports and typed inputs/outputs.  
- Use Biome defaults (2-space indent, semicolons off, single quotes).  
- Keep functions small; favor pure helpers in `src/utils/`.  
- Names: commands/kebab (`extract-imessages`), constants SCREAMING_SNAKE, types `PascalCase`.

## Testing Guidelines
- Framework: Vitest (via Bun). Import from `vitest` and keep tests colocated under `__tests__`.  
- Name tests after behavior: `cli.test.ts`, `timeline-merge.test.ts`, etc.  
- Use `bun test --runInBand` if interacting with the filesystem.  
- Add fixtures under `src/__fixtures__/` and clean up temp files in `afterEach`.  
- Aim for coverage on new code paths; add regression tests for every bug fix.

## Commit & PR Workflow
- Commits should follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) to satisfy commitlint.  
- Before pushing: `bun run validate`. Stage only purposeful changes.  
- PRs: clearly state intent, link issues, and note testing performed. Screenshots or CLI logs help for UX/output changes.  
- Rebase or merge `origin/main` before requesting review; resolve conversations and ensure required checks are green.

## Releases & Changesets
- Changesets drive versioning and changelog entries; run `bun changeset` (or `bun run version:gen`) for every user-facing change.  
- Pre-releases (alpha/beta/canary) rely on Changesets pre mode; exit pre mode before final release.  
- Tagging: use `changeset publish --tag canary` for canaries; normal releases use `bun run release` with provenance enabled.

## Security & Configuration
- Keep secrets out of the repo; rely on GitHub Secrets for tokens (e.g., `NPM_TOKEN`).  
- Prefer signed commits if available; never bypass CI checks.  
- Use `bun pm ls` to spot dependency issues and `npm audit` for quick scans.
