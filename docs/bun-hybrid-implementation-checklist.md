# Bun Hybrid Implementation Checklist

Use this checklist to integrate best practices while adopting a Bun‑hybrid
workflow. Check items off as we implement them.

## Packaging & TypeScript

- [x] package.json: add `sideEffects: false` (after auditing side effects)
- [x] package.json: add `exports["./package.json"] = "./package.json"`
- [x] package.json: include `CHANGELOG.md` in `files`
- [x] tsconfig.json: enable `declarationMap: true` (build config only; base
      doesn't require)
- [x] tsconfig.base.json: enable `verbatimModuleSyntax: true`
- [x] tsconfig.base.json: enable `preserveShebang: true` (or add wrapper bin)
- [x] Verify dist CLI shebang is preserved or add small wrapper bin script

## Testing (Vitest primary; Bun optional)

- [x] vitest.config.ts: set `coverage.all: true`
- [x] vitest.config.ts: per‑file coverage thresholds (lines/statements 80,
      branches 75, functions 80)
- [x] vitest.config.ts: add `testTimeout` (e.g., 20000) and `hookTimeout` if
      needed
- [x] package.json: add optional `dev:bun`, `smoke:bun`, `test:bun:exp` scripts

## ESLint & Prettier

- [x] Add `eslint-plugin-import` as a devDependency
- [x] eslint.config.js: add `import/order` rule (alphabetize, groups, newlines)
- [x] Optional: add `typecheck` script (`tsc -p tsconfig.eslint.json --noEmit`)
- [x] Optional: add lint‑staged & husky hooks

## Changesets & Release hygiene

- [x] .changeset/config.json: update repo to `nathanvale/imessage-timeline`
- [x] package.json `files`: add `CHANGELOG.md`

## Bun Hybrid Adoption

- [x] Add Bun scripts without changing pnpm as the package manager
- [x] Document Node/Vitest as primary; Bun as optional speedup
- [x] (Optional CI) Add a Bun canary job to run `smoke:bun`
- [x] Add Firecrawl Bun smoke script (`scripts/smoke-firecrawl-bun.ts`) What?
      So... ESLint... So... So typescript doesn't... Typecheck text files at
      all. Test files at all.What? So... ESLint... So... So typescript
      doesn't... Typecheck text files at all. Test files at all.So we do no type
      checking on test files at all?

## CI Canary Tasks

- [x] Create `.github/workflows/bun-canary.yml` (install Bun, pnpm install,
      build, run smoke & limited tests)

## Firecrawl / MCP

- [x] Keep Firecrawl MCP server on Node (no change needed)
- [ ] (Optional) Add Bun runtime smoke test for Firecrawl SDK usage

---

Progress Log

- [x] Initialize checklist file
- [x] Updated package.json (sideEffects, exports mapping, CHANGELOG in files,
      typecheck & Bun scripts)
- [x] Added Bun canary workflow
- [x] Added Firecrawl Bun smoke script
- [x] Added lint-staged configuration & Husky pre-commit hook
- [x] Documented Bun hybrid usage in README
- [x] Fixed all lint errors (0 errors remain; 16 console warnings are
      pre-existing)
- [x] Updated test builders to fix type issues (removed non-existent
      TapbackPayload, fixed TestMessage type)
- [x] Configured declarationMap only in tsconfig.json (build config) to avoid
      eslint issues

## Status: ✅ COMPLETE

All 14 initial checklist items are complete. The implementation includes:

- Full TypeScript 5.9+ configuration with strict checking and modern features
- Vitest testing with coverage thresholds (80% lines/statements, 75% branches)
- ESLint flat config with import ordering and no-console warnings
- Prettier with lint-staged pre-commit hooks via Husky
- Bun optional scripts alongside pnpm-locked primary workflow
- CI canary workflow for Bun compatibility testing
- All lint/type errors resolved; build succeeds
