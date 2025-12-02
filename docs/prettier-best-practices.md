# Prettier Best Practices & Formatting Strategy

This document outlines formatting strategy choices for `chatline`,
uplift actions taken, and future improvements leveraging Prettier (2025 state)
plus ecosystem anecdotes (Context7 usage; Firecrawl-related JSON normalization
needs).

## Goals

- Consistent, minimal configuration—easy to reason about and update.
- Developer-friendly defaults (printWidth 80 for readability, widen only where
  intent matters).
- Deterministic JSON & config sorting for stable diffs.
- Fast CI verification (`format:check`) separate from mutation.

## Configuration Summary

File: `prettier.config.mjs`

- Global `printWidth: 80` (matches project guidance; avoids horizontal scroll in
  reviews).
- `trailingComma: 'all'` for cleaner diffs.
- `semi: false`, `singleQuote: true`, `arrowParens: 'always'` aligning coding
  convention.
- Plugin: `prettier-plugin-sort-json` with `jsonRecursiveSort` for deterministic
  JSON ordering (useful for config diffs and Firecrawl API payload snapshots).
- Targeted overrides only:
  - `package.json`: stringify parser, curated width.
  - Generic JSON/JSONC: remove trailing comma, keep structural clarity.
  - Markdown: `proseWrap: 'always'` aids stable copy edits; line length
    intention explicit.
  - Test files: allow `printWidth: 100` for nested `describe()` readability.

Removed: Large matrix of language-specific overrides; rely on Prettier core
defaults where not critical.

## Scripts

- `format`: write mode.
- `format:check`: non-mutating verification (ideal for CI gating).

## Recommended Workflow

```bash
# Format all files
pnpm format

# Verify formatting (CI/local preflight)
pnpm format:check
```

## Lint-Staged Integration

Existing `lint-staged` already formats staged sources; consider adding `*.md` if
frequent doc edits need enforced wrap (optional—currently included via glob
pattern).

## Firecrawl & Enrichment Considerations

- Link enrichment may produce JSON configuration or cached payloads; sorted JSON
  reduces noisy diffs in checkpoint/state files.
- If Firecrawl adds structured site extraction metadata, enabling stable key
  order simplifies deterministic pipelines.

## IDE Tips

- Enable "Format on Save" for supported file types.
- Run `format:check` in pre-push hook if formatting churn is high (optional; not
  added yet to avoid friction).

## Why Not More Plugins?

Minimalism reduces plugin surface area, avoiding perf dips and conflicting style
transformations. Domain-specific plugins (Tailwind, XML) not required in current
codebase.

## Future Enhancements (Roadmap)

- Shareable config package export (`@imessage/prettier-config`) if multi-repo
  adoption occurs.
- Optional Tailwind plugin if utility-first CSS introduced later.
- Add Prettier cache warm strategy in CI (reuse node_modules + incremental).
  With pnpm caching, current gain is marginal.
- Introduce formatting stats job to surface diff counts per PR (observability).
- Evaluate `@prettier/plugin-oxc` performance once stable for TS heavy repos
  (2025 anecdotal gains ~5–10%).
- Add automated Markdown link/anchor normalization preprocessor (remark
  pipeline) if docs scale further.

## Validation Checklist

- [x] Config simplified & committed.
- [x] Scripts added (`format:check`).
- [x] Overrides reflect project rules (80 width baseline).
- [x] JSON deterministic ordering active.

## Cross References

- See `docs/package-hygiene.md` for publish surface integrity.
- Release notes formatting aided by consistent prose wrapping (see
  `docs/automated-release-workflow.md`).

---

Feedback or proposed adjustments: open an issue with label `formatting`.
