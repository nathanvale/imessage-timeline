# Branch Protection Policy (proposed)

This document defines recommended protection settings for `main` to ensure
quality, security, and traceability.

## Overview

Goals:

- Prevent direct, unreviewed pushes
- Enforce status checks + semantic standards
- Maintain linear, signed, and provenance-attested history
- Enable tag-driven release automation with confidence

## Required status checks

Enable branch protection with these required checks (must pass before merge):

- PR quality (full workflow) — or job-level checks if you prefer granularity:
  - Lint
  - Typecheck
  - Tests + Coverage
  - Repo quality checks
- Commitlint — commit message format validation
- PR Title Lint — semantic pull request title enforcement
- Dependency Review — optional; mark as required to block moderate+ severity
- CodeQL — optional; can run post-merge if latency is a concern

Context names to select (confirm exact labels in GitHub UI):

- `PR quality` (or the job names above)
- `Commitlint`
- `PR Title Lint`
- `Dependency Review`
- `CodeQL`

## Additional protections

Recommended settings:

- Require pull request reviews: 1 (consider 2 for critical packages)
- Dismiss stale approvals on new commits: enabled
- Require review from Code Owners (if CODEOWNERS is added later): enabled
- Require status checks to pass before merging: enabled
- Require branches to be up to date before merging: enabled (ensures latest base
  ref tests run)
- Require signed commits: enabled (GPG or GitHub verified signatures)
- Require linear history: enabled (disallow merge commits; use squash or rebase)
- Allow squash merges: enabled
- Allow rebase merges: enabled
- Disallow force pushes: enabled
- Disallow deletions: enabled
- Lock branch: disabled (avoid blocking automation)

## Tag-driven release flow

Once protections are in place, convert `release.yml` trigger from manual to
`push` on version tags:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

Publish process:

1. Merge changesets PR (version bump commit generated)
2. Tag created by Changesets action (`vX.Y.Z`)
3. Release workflow triggers automatically, builds, publishes, and generates
   SBOM

Ensure `NPM_TOKEN` scoped to publish only; use provenance (`id-token: write`)
for npm registry attestations.

## Security considerations

- All workflows pinned to SHAs; review updates regularly
- Use OIDC (`id-token: write`) with npm provenance where supported
- Keep `contents: write` limited to release/publish workflows

## Future enhancements

- Add CODEOWNERS for critical paths
- Integrate SLSA build provenance once supported by package managers
- Introduce automated license scanning in PR quality workflow

---

Last updated: 2025-11-12.
