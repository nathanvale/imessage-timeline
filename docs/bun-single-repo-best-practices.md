## Bun single‑repo best practices (testing, linting, releases)

Date: 2025‑11‑11

This note evaluates moving the repository to “Bun for everything,” including the
test runner, and outlines practical options with current dependencies (sharp,
better‑sqlite3, Firecrawl SDK), Vitest, ESLint, Prettier, and Changesets.

---

### TL;DR viability

- Fully Bun‑only is possible, but has caveats around native addons and test
  runner feature parity. A hybrid approach is safest now:
  - Keep pnpm for dependency management and Changesets publishing.
  - Keep Vitest for tests (coverage, jsdom, reporters) on Node.
  - Adopt Bun for local CLI runtime and scripts where it brings speed.

If you still want “Bun for tests,” run an experiment branch and validate the
items below before switching CI defaults.

---

### Compatibility snapshot

| Area                 | Status with Bun | Notes                                                           |
| -------------------- | --------------- | --------------------------------------------------------------- |
| TypeScript compile   | ✅              | `moduleResolution: bundler` works well                          |
| CLI runtime          | ✅              | Pure ESM is fine in Bun                                         |
| sharp                | ⚠️              | Native addon; may compile from source; ensure libvips present   |
| better‑sqlite3       | ⚠️              | Native addon; prebuilds may not include Bun; may compile        |
| Firecrawl SDK        | ✅              | Uses fetch/HTTP; should work under Bun runtime                  |
| MCP Firecrawl server | ✅ Node         | Stays Node‑driven via `npx firecrawl-mcp`                       |
| Vitest on Node       | ✅              | Current setup is robust (jsdom, coverage, CI reporters)         |
| Vitest on Bun        | ⚠️ experimental | Some features may differ; confirm threads, coverage, jsdom      |
| bun test             | ⚠️ gaps         | Lacks some Vitest niceties (coverage/reporters parity, plugins) |

Key risk: native addons (sharp, better‑sqlite3). Expect CI toolchain to build
from source or pin versions with Bun‑compatible prebuilds.

---

### Recommended strategies

1. Conservative hybrid (recommended for CI)

- Keep current stack for tests (Vitest on Node). Retains jsdom setup, coverage
  thresholds, junit/html reports, and threads pool tuning.
- Add optional Bun scripts for local speed where safe:
  - `bun run dist/cli.js` or `bun run src` workflows during dev.
  - Use Bun to execute small tooling scripts that are pure JS/TS.

2. Experimental Bun tests (branch trial)

- Goal: switch to Bun runtime for tests while keeping Vitest features.
- Validate in a branch:
  - jsdom compatibility with `@testing-library/react` and
    `@testing-library/jest-dom` matchers.
  - Coverage parity (V8) and CI reporters (junit, html, text‑summary).
  - Threads isolation and max worker caps similar to current config.
  - Module aliasing (`#schema`, `#enrich`, …) continue to resolve.
  - Native addons build reliably across CI matrix.
- If parity is not achievable, keep Node for tests and use Bun elsewhere.

---

### Best practices checklist for a Bun‑first repo

Packaging & TS

- Keep ESM‑only package with explicit exports and types.
- In `tsconfig.base.json`: enable `verbatimModuleSyntax`, `declarationMap`,
  `preserveShebang` (see config review doc).
- Set `type` to `module` (already) and ensure all binaries invoked via explicit
  `node` or `bun` shims as needed.

Scripts & Tooling

- Respect the project rule to use pnpm for dependency management.
- If using Bun CLIs locally, prefer `bunx <tool>` for ad‑hoc execution but keep
  `pnpm` scripts as the source of truth in `package.json`.
- For tests, keep `pnpm vitest` as canonical. Add an experimental `test:bun`
  script in a branch only after validation.

Testing

- If staying with Vitest: keep `environment: 'jsdom'`, thread pool, and coverage
  thresholds; consider `coverage.all: true` and per‑file targets.
- If trialing Bun tests: recreate a minimal subset of suites and ensure matcher
  parity (jest‑dom), async utilities (`screen.findBy*`), and mock APIs are
  feature‑complete for your cases.

Native addons (sharp, better‑sqlite3)

- Ensure CI image has build toolchain: Python, C/C++ toolchain, `pkg‑config`.
- Install system deps (e.g. libvips for sharp) before bun/npm install.
- Consider pinning versions known to build on Bun, or switch to pure JS
  alternatives if feasible for test environments.

Firecrawl

- SDK usage under Bun is fine for runtime fetches.
- MCP server remains Node‑launched with `npx firecrawl-mcp`; no need to change
  that when adopting Bun elsewhere.

CI

- Keep Node 22 job as primary for tests.
- Optionally add a Bun job that runs a smoke subset (CLI run, a few unit tests)
  to surface compatibility regressions early.

---

### Suggested scripts (non‑breaking)

Keep existing scripts; optionally add these for experimentation:

```jsonc
{
  "scripts": {
    "dev:bun": "bun run dist/cli.js",
    "smoke:bun": "bun run ./dist/cli.js --help",
    "test:bun:exp": "bunx vitest run", // experimental; validate before CI
  },
}
```

Note: `bunx vitest` is experimental in this context. Prefer the standard
`pnpm vitest` for CI until feature parity is proven.

---

### Migration plan (if you decide to adopt Bun more deeply)

1. Create a branch `feat/bun-experiment`.
2. Add the optional scripts above; do not alter CI yet.
3. Run a native addon build check on CI with Bun (Ubuntu/macOS):
   - sharp compiles and runs a tiny resize test.
   - better‑sqlite3 opens a DB and performs a simple query.
4. Attempt `bunx vitest run` on a subset of tests; compare coverage and timing
   vs Node.
5. If parity holds, introduce a parallel CI job for Bun tests.
6. After 2–3 green cycles, consider switching default test job to Bun or keep
   both (Node as primary, Bun as canary).

---

### Decision guidance

- If you value the existing Vitest integrations (coverage, junit, rich mocks,
  jsdom), staying on Node for tests is the lowest risk with the highest
  determinism.
- Use Bun where it’s unambiguously beneficial (script execution, CLI dev speed)
  without changing the package manager or CI test substrate.
- Revisit “Bun for tests” after native addon story and coverage/reporting parity
  meet your needs in practice.

---

### What stays the same

- pnpm remains the package manager of record.
- Changesets continues to version and publish.
- ESLint flat config and Prettier rules unchanged; you can invoke them through
  pnpm or bunx locally.

---

### Action items

- [ ] Decide on hybrid vs full Bun goals.
- [ ] If hybrid, add optional local scripts and a small Bun smoke job in CI.
- [ ] If full, create the experiment branch and validate parity items.
- [ ] Keep Firecrawl MCP server on Node; no change needed.
