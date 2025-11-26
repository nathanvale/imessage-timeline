# Canonical Changesets Flow — Zero-touch releases

This document is both a human checklist and an AI agent playbook for end-to-end
automated releases using Changesets.

## Quickstart (what you do)

1. Use Conventional Commit PR titles

- feat: … → minor
- fix: … → patch
- refactor!: … or BREAKING CHANGE: in body → major

2. Don’t worry about changesets

- If you don’t add one, the bot creates it from your PR title automatically.

3. Let CI merge and publish

- A “Version Packages” PR is opened by CI and auto-merged after checks; publish
  happens automatically with tags and GitHub Release assets.

4. Optional prerelease streams

- Use the “Changesets Pre-Mode Toggle” workflow to enter/exit beta/rc/next.

That’s it—no manual tagging or npm publish.

## What you (humans) do (details)

- Write PR titles using Conventional Commit style:
  - `feat: ...` → minor release
  - `fix: ...` → patch release
  - `refactor!: ...` or body includes `BREAKING CHANGE:` → major release
- Optional: add a changeset manually with `pnpm version:gen` if you want custom
  notes or multi-package details. If you don’t, the bot will generate one for
  you based on the PR title.
- If you want prerelease streams:
  - Trigger pre-mode with the workflow “Changesets Pre-Mode Toggle” (Actions →
    Run workflow) and choose `enter` + channel (`beta`, `rc`, or `next`).
  - To exit pre-mode, run the same workflow with `exit`.

That’s it. No tagging or manual publishes.

## What the automation does

1. On PRs to main:
   - Ensures a changeset exists. If missing, it creates `.changeset/*.md` using
     the PR title to determine semver bump.
2. On push to main:
   - `Changesets Manage & Publish` opens/updates the **Version Packages** PR or
     (when that PR merges) publishes to npm with `pnpm release` and creates the
     tag.
3. Nightly at 02:00 UTC (only when pre-mode is active):
   - `Alpha Snapshot Release` publishes `-alpha-YYYYMMDDHHMMSS` snapshots to the
     `alpha` npm dist-tag. If pre-mode is off, this job skips to avoid confusion
     with stable releases.
4. On new tags `v*.*.*`:
   - `Tag Assets` builds, generates an SBOM, and creates a GitHub Release with
     notes.
5. Version Packages PR auto-merge:
   - `Auto-merge Version Packages PR` enables auto-merge (squash). It merges
     after required checks pass (no human approval needed).

## Labels, commands, and signals

- Pre-mode toggle is done via the `Changesets Pre-Mode Toggle` workflow inputs;
  no special labels are required.
- You may optionally add a label `release:pre-toggle` to organize those PRs.
- For strict beta cadence, you can schedule pre-mode entry/exit using
  repository-level scheduled workflows.

## Required checks (branch protection)

Ensure these checks are required before merging:

- `PR quality` (workflow conclusion) or its job-level checks: `Lint`,
  `Typecheck`, `Tests + Coverage`, `Repo quality checks`
- `Commitlint`
- `PR Title Lint`
- Optionally enforce: `Dependency Review`, `CodeQL`

## Notes for AI agents

- If a PR is missing a changeset, create one using the same logic as the
  `Auto-generate Changeset (PR)` workflow, and push it to the PR branch.
- To start a beta/rc stream, dispatch `Changesets Pre-Mode Toggle` with
  `enter` + `beta`/`rc`.
- To end the stream, dispatch the same with `exit`.
- Alpha snapshots should only be produced while pre-mode is active; otherwise,
  skip snapshot behavior.
- Avoid pushing tags manually; tags are created by the publish step.

## Troubleshooting

- Version PR won’t merge: open the PR checks and ensure all required checks are
  green. If auto-merge wasn’t enabled, the auto-merge workflow may have missed
  the event—re-run the workflow or enable auto-merge manually in the PR UI.
- Publish failed:
  - Verify `NPM_TOKEN` is present and has publish scope to the
    `imessage-timeline` package.
  - Ensure `id-token: write` permissions are enabled where provenance is
    required.
- Alpha snapshots not appearing: check the cron logs for
  `Alpha Snapshot Release`.

## Reference scripts (package.json)

- `release`: `changeset publish` (used by publish workflows)
- `release:snapshot:canary`:
  `changeset version --snapshot canary && changeset publish --tag canary` ⚠️
  **Only works when NOT in pre-mode** (`.changeset/pre.json` must not exist)
- `version:pre`: `changeset version` (not used directly; handled by action)

---

Last updated: 2025-11-12.
