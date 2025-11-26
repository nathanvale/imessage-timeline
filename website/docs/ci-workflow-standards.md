# CI workflow standards

This repository uses a few conventions to keep workflows secure, deterministic,
and easy to maintain.

## DRY setup via composite actions

Use these composite actions instead of hand-rolled setup steps:

```yaml
- name: Standard CI Env
  uses: ./.github/actions/standard-ci-env

- name: Setup pnpm toolchain
  uses: ./.github/actions/setup-pnpm
  with:
    # For publish flows
    registry-url: 'https://registry.npmjs.org'
```

Effects:

- Exports `TZ=UTC` and `TF_BUILD=true`
- Enables Corepack, pins pnpm via `packageManager`
- Sets Node version from `.nvmrc`
- Configures and caches pnpm store keyed by `.nvmrc` + `pnpm-lock.yaml`

## Permissions (least privilege)

Prefer the minimum required:

- Read-only by default: `contents: read`
- Write only when needed: `contents: write`, `pull-requests: write`,
  `id-token: write` (for npm provenance)
- Add `actions: read` where the workflow reads other workflows/actions

## Concurrency groups

Avoid duplicate runs by scoping groups:

- PR quality: `${{ github.workflow }}-${{ github.ref }}`
- Release: `release-${{ github.ref }}`
- Channel release:
  `${{ github.workflow }}-${{ github.ref }}-${{ inputs.channel }}`

Set `cancel-in-progress: true` to auto-cancel superseded runs.

## Action pinning

Pin all third-party actions to immutable commit SHAs to reduce supply-chain
risk. Refresh SHAs periodically (Dependabot can assist).

## Artifacts and reports

- Test results (Vitest JUnit): `./test-results/junit.xml`
- Coverage artifacts (HTML, lcov, text-summary): `./test-results/coverage/`
- Retention: 14–30 days depending on workflow importance

## Reporting in CI

- Set `TF_BUILD=true` to enable CI-specific reporters and seeds
- Ensure `TZ=UTC` for deterministic dates and snapshots

## When to use reusable workflows

If multiple repos share the same patterns, extract these conventions into a
reusable workflow (`workflow_call`) in a central repo. Within a single repo,
composite actions are usually sufficient and simpler.

---

Last updated: 2025-11-12.
