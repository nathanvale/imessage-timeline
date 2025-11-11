## Configuration & Best Practices Review (November 2025)

Project: `imessage-timeline`

Scope covered: TypeScript (build & emit), ESM packaging, Exports strategy,
Vitest, Coverage, ESLint (flat config), Prettier, Changesets, Release hygiene,
CLI delivery, Automation opportunities (Firecrawl).

---

### 1. Executive Summary

The project already aligns with many 2025 best practices: strict TypeScript
settings, modern flat ESLint config, Vitest with thread pool limits, CI specific
reporters, and a lean published surface. Remaining gaps revolve around polishing
ESM publish ergonomics, strengthening coverage enforcement, import/order
consistency, and automating config drift detection (future Firecrawl
integration).

---

### 2. Current State Snapshot

| Area          | Current                                                            | Notes                                      |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Module format | Pure ESM (`"type": "module"`)                                      | Single root export only                    |
| Export map    | Root export + types                                                | No subpath exports, no package.json export |
| Declarations  | `declaration: true`, source maps                                   | No `declarationMap` yet                    |
| TS target     | ES2022, `moduleResolution: bundler`                                | Good for modern Node + bundlers            |
| Strictness    | `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` | Strong correctness posture                 |
| Vitest env    | `jsdom`, threads pool (max 8)                                      | Good isolation & concurrency control       |
| Coverage      | Global thresholds (70%)                                            | No `all: true`, no per‑file thresholds     |
| ESLint        | Flat config, type aware segment                                    | Good layering; lacks import ordering       |
| Formatting    | Prettier with granular overrides                                   | Extensive, may be simplified later         |
| Changesets    | Config present, repo points to old name                            | Needs repo update                          |
| CLI           | Shebang in source TS                                               | Need to ensure preserved post build        |
| Supply chain  | `provenance: true`, minimal files list                             | Add CHANGELOG, sideEffects flag            |

---

### 3. Strengths

1. Robust TypeScript strictness (edge cases like optional property correctness &
   unchecked index access covered).
2. Flat ESLint config with targeted type-aware rules reduces lint cost for
   non-TS files.
3. Vitest concurrency tuned (threads capped) + CI aware reporters and output
   paths.
4. Minimal publish surface (`files` whitelist) aids consumer install size &
   security.
5. Provenance publishing set, improving supply chain trust.
6. Path alias parity between TS and Vitest ensures consistent imports.

---

### 4. Gaps / Risks

| Gap                                                                    | Impact                                     | Category         |
| ---------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| Missing `declarationMap`                                               | Slightly reduced consumer DX               | Types            |
| Missing `sideEffects: false`                                           | Leaves tree-shaking optimization implicit  | Packaging        |
| No `./package.json` export entry                                       | Some tooling resolution gaps               | Packaging        |
| Coverage not enforcing `all` & per-file                                | Untested files invisible to quality gate   | Testing          |
| Lack of import order rule                                              | Inconsistent diffs / churn                 | Lint consistency |
| Shebang may be stripped by tsc                                         | Potential CLI execute failure if lost      | Distribution     |
| Outdated Changesets repo reference                                     | Changelog links misdirect                  | Release          |
| No explicit `testTimeout`                                              | Potential hidden hanging tests             | Testing          |
| Not using newer TS features (`verbatimModuleSyntax`, `declarationMap`) | Slight DX loss                             | TypeScript       |
| No automation for config drift                                         | Manual effort to monitor ecosystem changes | Maintenance      |

---

### 5. Recommended Improvements (Prioritized)

**High Priority**

1. Add to `package.json`: `"sideEffects": false`, export for `./package.json`.
2. Enable `declarationMap: true` + `verbatimModuleSyntax: true` in
   `tsconfig.base.json`.
3. Strengthen coverage: `coverage.all: true`, raise per-file thresholds
   (lines/statements 80, branches 75, functions 80) & enable `perFile: true`.
4. Preserve CLI shebang: confirm `tsconfig` has `preserveShebang: true` (TS
   5.4+), or introduce a tiny wrapper script.
5. Update `.changeset/config.json` repo reference to
   `nathanvale/imessage-timeline`.

**Medium Priority** 6. Introduce `eslint-plugin-import` with `import/order`
alphabetical + groups. 7. Add `testTimeout` (e.g. 20_000 ms) & optionally
`hookTimeout`. 8. Add `coverage.dependantData: true` (when Vitest adds stable
support) to improve branch accuracy (future looking). 9. Add script:
`"typecheck": "tsc -p tsconfig.eslint.json --noEmit"`.

**Low Priority / Optional** 10. Add subpath exports if you decide to expose
internal modules. 11. Add `lint-staged` + pre-commit optimization. 12. Implement
Firecrawl-based config drift job (see Section 9).

---

### 6. Concrete Snippet Proposals

`package.json` (additions excerpt):

```jsonc
{
  "sideEffects": false,
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./package.json": "./package.json",
  },
}
```

`tsconfig.base.json` (`compilerOptions` additions):

```jsonc
{
  "compilerOptions": {
    "declarationMap": true,
    "verbatimModuleSyntax": true,
    "preserveShebang": true,
  },
}
```

`vitest.config.ts` (inside `test.coverage`):

```ts
coverage: {
  provider: 'v8',
  all: true,
  reporter: process.env.TF_BUILD ? ['text-summary','html','lcov'] : ['text-summary','html'],
  reportsDirectory: process.env.TF_BUILD ? './test-results/coverage' : './coverage',
  exclude: ['src/**/*.d.ts','**/*.test.*','dist/**','vitest.config.*'],
  thresholds: { lines: 80, statements: 80, branches: 75, functions: 80, perFile: true },
}
```

ESLint import ordering layer (flat config fragment):

```js
import importPlugin from 'eslint-plugin-import'

export default [
  // existing config blocks ...,
  {
    name: 'project/imports',
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'warn',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
        },
      ],
    },
  },
]
```

CLI wrapper alternative (if not using `preserveShebang`):

```js
#!/usr/bin/env node
import('../dist/cli.js')
```

---

### 7. Validation / Edge Considerations

| Area             | Edge Case                                  | Mitigation                        |
| ---------------- | ------------------------------------------ | --------------------------------- |
| Shebang          | Build strips comment                       | Add `preserveShebang` or wrapper  |
| SideEffects flag | Hidden global code (e.g. polyfills)        | Audit entrypoints before enabling |
| Coverage all     | Large new modules drop %                   | Enforce incremental discipline    |
| Import ordering  | Large diff churn on first run              | Communicate in PR description     |
| Subpath exports  | Breaking consumers expecting deep requires | Mark as new minor version         |

---

### 8. Roadmap (Suggested Sequence)

1. Packaging polish (sideEffects, declarationMap, shebang preservation).
2. Coverage strengthening.
3. Import order + type safety rule expansion.
4. Changesets repo correction & add CHANGELOG to `files`.
5. Firecrawl automation.

---

### 9. Firecrawl / Viacrawl Automation Plan

1. Curate authoritative doc URLs (ESLint flat config, TypeScript release notes,
   Vitest advanced docs, Node ESM guide).
2. Use Firecrawl map + scrape to harvest markdown snapshots.
3. Extract structured config guidance (simple heuristics: fenced JSON, tables
   referencing options) into a local store (JSON lines).
4. Parse local project configs into AST (e.g. via `typescript` + lightweight
   custom walkers for `export default [...]`).
5. Diff recommended vs actual (rule missing, threshold below recommendation,
   option deprecated) and emit `docs/config-drift.md`.
6. Gate CI with a script: fails if drift severity > defined threshold.
7. (Optional) Use embeddings to cluster new guidance and open an automated PR
   with proposed config deltas.

Success Criteria:

- Drift job produces deterministic output within < 5s warm run.
- No false positives > 5% over a rolling 30‑day window.

---

### 10. Quick Win Checklist

- [ ] Add sideEffects flag
- [ ] Add declarationMap + verbatimModuleSyntax
- [ ] Preserve CLI shebang
- [ ] Strengthen coverage config
- [ ] Update Changesets repo
- [ ] Add import/order lint layer
- [ ] Add typecheck script
- [ ] Implement drift automation (post Firecrawl activation)

---

### 11. Optional Enhancements

| Enhancement                            | Benefit                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| Subpath exports                        | Granular consumer imports, potential tree-shake improvements |
| lint-staged                            | Faster pre-commit feedback                                   |
| Security scan (Scorecards)             | Supply chain confidence                                      |
| Per-module API docs (TS Doc + typedoc) | Consumer onboarding                                          |

---

### 12. Summary

The configuration foundation is solid and future-forward. Implementing the
prioritized set (Sections 5 & 8) will close remaining polish gaps around
packaging clarity, coverage rigor, and automation. Firecrawl can later provide a
sustainable feedback loop to keep configurations aligned with evolving ecosystem
guidance.

---

_Generated: 2025-11-11_
