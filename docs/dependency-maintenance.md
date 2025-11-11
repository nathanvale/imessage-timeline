## Dependency & Maintenance Guide

This document explains how we keep dependencies up to date and the project
healthy over time. It covers what’s automated, what to do manually, and how to
respond to security events.

### What’s automated today

- Renovate weekly maintenance
  - Groups related updates (devDependencies, runtime deps, vitest, eslint) via
    `renovate.json` rules.
  - Auto-merges safe minor/patch devDependency updates (lockfile + manifest
    only).
  - Lockfile maintenance runs early Monday (UTC) to keep resolution fresh.
  - Location: `.github/renovate.json` (ensure the GitHub Renovate app is
    installed).

- GitHub Actions updates
  - Renovate also handles workflow action version bumps under the
    `github-actions` manager.
  - Commit prefix semantic: `chore(gha): …` via packageRules.

-- PR gating and security scanning

- Dependency Review blocks risky new dependencies in PRs (severity ≥ moderate by
  default).
- OSV Scanner / security workflow detects newly disclosed CVEs.
- Locations:
  - `.github/workflows/dependency-review.yml`
  - `.github/workflows/security.yml`

- Package hygiene checks
  - Publint + AreTheTypesWrong run in CI to ensure publish metadata and types
    are correct.
  - Location: `.github/workflows/package-hygiene.yml` and
    `docs/package-hygiene.md`

- Provenance and SBOM on release
  - Releases publish with npm OIDC provenance and produce a CycloneDX SBOM
    artifact.
  - Location: `.github/workflows/release.yml` and
    `docs/security-supply-chain.md`

### Manual maintenance (as needed)

- Inspect available updates
  - Outdated overview: `pnpm outdated`
  - Why a package is included: `pnpm why <name>`

- Perform safe upgrades locally
  - Interactive constrained update: `pnpm up -Lri`
  - Full latest (be cautious): `pnpm up --latest`
  - After upgrading: run tests and package checks
    - `pnpm test`
    - `pnpm coverage` (optional)
    - `pnpm hygiene`

- Audit vulnerabilities
  - Quick scan: `pnpm audit` (triage, link to advisories)
  - If transitive: prefer upgrading the top-level maintainer package first

### Pull request workflow

1. For devDependencies: Dependabot PRs labeled `dev-dependencies` will
   auto-merge after CI and scope checks.
2. For direct/runtime deps: Review carefully, ensure tests are green, and add a
   Changeset entry as needed (e.g., `fix:` for security patches, `chore:` for
   routine bumps).
3. If Dependency Review flags a risk, either upgrade to a safe version or
   document a temporary mitigation and open a tracking issue.

### Security remediation playbook

1. OSV alerts or Dependabot security notifications surface a CVE.
2. Confirm impact with `pnpm why` and the SBOM artifact from the latest release.
3. Identify the minimal upgrade path (patch/minor preferred). Update and open a
   PR with a Changeset.
4. If no fix exists, consider pinning, patching (e.g., `patch-package`), or
   temporary deny policies; document in the PR.

### Node and tooling policy

- Engines: `package.json` specifies the supported Node range. Keep local Node
  aligned with `engines.node` for consistent CI parity.
- Package manager: We standardize on `pnpm` (lockfile is authoritative).

### Quick reference commands

```bash
# List available updates
pnpm outdated

# Interactive minor/patch updates, with prompts
pnpm up -Lri

# Run tests and coverage
pnpm test
pnpm coverage

# Package hygiene checks (publint + types)
pnpm hygiene

# Vulnerability scan
pnpm audit
```

### Renovate Quickstart

1. Install the Renovate GitHub App (organization level) if not already active.
2. Review grouping rules in `.github/renovate.json`:
   - Dev minor/patch auto-merge (`devDependencies (minor/patch)` group).
   - Runtime deps grouped separately (manual review, semantic commit prefix
     `chore(deps):`).
   - Tooling bundles (eslint, vitest) for coherent updates.
3. For a one-off refresh outside schedule: trigger Renovate by closing/reopening
   a stale PR or using the dashboard (if enabled).
4. Override behavior per-package with inline `packageRules` additions (e.g.,
   pinning, separate major group).

### FAQ

- Why Renovate over Dependabot?
  - Advanced grouping, custom schedules, pnpm lockfile maintenance, semantic
    commit prefixes, and auto-merge logic are centralized.
- How are auto-merges restricted?
  - Only dev minor/patch updates meeting branch status and file-change
    constraints; major bumps always require manual review.
- How do I force a rebase or refresh?
  - Comment `@renovate rebase` on the PR or use the Renovate dashboard.
- Where do security results show up?
  - GitHub Security tab and failing PR checks (Dependency Review + OSV
    workflow).

---

For changes to cadence or policy, update `.github/renovate.json` and related
workflows, then reflect the change here.
