# Release Channels & Prerelease Strategy

> **⚡ Quick Start:** For practical, step-by-step instructions on publishing
> pre-releases, see the **[Pre-Release Guide](./pre-release-guide.md)**

This document defines the multi-channel release process for `chatline`,
enabling safe iteration and promotion flows while preserving stable `latest`
integrity and supply chain guarantees.

## Goals

- Accelerate feedback cycles (next/beta) without blocking stable work.
- Provide structured promotion path: next → beta → rc → latest.
- Support canary snapshots for ultra-fast validation (e.g., CI, downstream
  tests).
- Maintain provenance, SBOM generation, and security posture across channels.
- Avoid main branch blockage during extended prerelease cycles.

## Channel Definitions

| Channel  | Tag                   | Purpose                                                           | Stability Expectations                     |
| -------- | --------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `next`   | `-next.N`             | Fast iteration after merge; early adopters & internal consumers.  | Unstable; breaking changes allowed.        |
| `beta`   | `-beta.N`             | Feature complete for target release; focus on integration & perf. | Mostly stable; avoid new breaking changes. |
| `rc`     | `-rc.N`               | Release candidate; only critical fixes.                           | Should mirror final unless blocker found.  |
| `canary` | `-canary-<timestamp>` | Snapshot of current tree for experimentation.                     | Ephemeral; not for production.             |

## Branching Guidance

We keep normal development on `main`. Prerelease mode MUST NOT be entered on
`main` for long-running cycles—create a short-lived branch (e.g.
`release/1.2-next`) and enter prerelease there. Merge back after `pre exit` and
final publish.

Using `main` directly for a short rc cycle (hours) is acceptable but risky;
prefer dedicated release branches to avoid blocking unrelated changes.

## Workflow Overview

GitHub workflow: `.github/workflows/channel-release.yml` provides
`workflow_dispatch` with inputs:

- `channel`: one of `next`, `beta`, `rc`.
- `intent`: `enter`, `version`, `publish`, `exit`, `snapshot`.

### Typical Sequence (Next → Beta → RC → Latest)

1. Create branch: `git checkout -b release/1.2-next`.
2. Run channel workflow `enter` with channel=`next`.
3. Iterate: add changesets, run `version` → `publish` as needed.
4. Promote to beta:
   - Exit `next`: `intent=exit` (removes prerelease suffix internally after next
     cycle?)
   - Enter beta: run workflow with channel=`beta` intent=`enter`.
5. Repeat version/publish until feature complete.
6. Enter rc: channel=`rc` intent=`enter`.
7. Final stabilization: small fixes + `version` + `publish` as required.
8. Exit rc: `intent=exit` then merge branch into `main` and trigger normal
   `Release` workflow (publishes to `latest`).

### Canary Snapshots

> ⚠️ **IMPORTANT:** Snapshot releases do NOT work when in pre-release mode.
>
> Changesets explicitly forbids `changeset version --snapshot` when
> `.changeset/pre.json` exists. To use snapshots, you must first exit pre-mode.
>
> **Alternative:** When in pre-mode, use versioned pre-releases instead
> (`changeset version` + `changeset publish`).

Use `intent=snapshot` to invoke `release:snapshot:canary` script (only when NOT
in pre-mode):

```
changeset version --snapshot canary
changeset publish --tag canary
```

Generates versions like `1.2.0-canary-20250101123045` (Changesets auto
timestamp). Consumers pin explicitly or use range if appropriate.

**Limitation:** This workflow only works when `.changeset/pre.json` does NOT
exist. For pre-release workflows, use versioned pre-releases instead.

## Scripts Added (package.json)

- `pre:enter:next|beta|rc` – enter prerelease mode with tag.
- `pre:exit` – prepare exit.
- `version:pre` – `changeset version` while in prerelease.
- `publish:pre` – `changeset publish` for prerelease tag.
- `release:snapshot:canary` – snapshot publishing (⚠️ only works when NOT in
  pre-mode).

## Dist-Tag Behavior

Entering prerelease with tag `next` causes publishes to receive the `next`
dist-tag. Same for `beta` and `rc`. Snapshot publishes use `canary` tag. After
`pre exit` + final `changeset version` + `changeset publish` on `main` (Release
workflow), packages publish to `latest`.

New packages during prerelease automatically get a `latest` tag on first publish
per Changesets behavior; subsequent prerelease publishes retain prerelease tag.

## Promotion Mechanics

Promotion (next → beta → rc) is implemented by exiting the prior tag and
entering the new one on a branch. This creates clean version progression:
`1.2.0-next.3` → `1.2.0-beta.0` → `1.2.0-rc.1` → `1.2.0`.

Avoid stacking simultaneous prerelease tags. Always exit the previous before
entering the next.

## Rollback Plan

If a prerelease proves invalid:

- Tag deprecation: Mark dist-tag as deprecated via npm advisory (manual step) or
  communicate in README.
- Revert branch commits and re-enter prerelease with incremented sequence
  (`next` again) if necessary.
- Never publish a lower semantic version; use new prerelease iteration (e.g.,
  from `1.2.0-beta.2` rollback fix becomes `1.2.0-beta.3`).

## Version Hygiene

Maintain granular changesets per logical change; avoid mega changesets. Ensure
dependency bumps propagate during prerelease (Changesets handles unsatisfied
ranges).

## Security & Provenance

All channel publishes still occur with OIDC provenance (Release workflow handles
stable; manual channel workflow relies on `NPM_TOKEN` & GitHub token). Consider
future enhancement: add SBOM generation step into channel workflow for parity
(optional now).

## CI Consumption Example

Downstream project wanting latest beta:

```
pnpm add /chatline@beta
```

For rc testing:

```
pnpm add /chatline@rc
```

For canary snapshot pin:

```
pnpm add /chatline@1.2.0-canary-20250101123045
```

## Risks & Mitigations

| Risk                                       | Mitigation                                                            |
| ------------------------------------------ | --------------------------------------------------------------------- |
| Main blocked by prerelease mode            | Use dedicated release branches.                                       |
| Confusing tag progression                  | Document sequence; enforce exit-before-enter.                         |
| Forgotten `pre exit` before stable publish | Checklist in PR template (add item).                                  |
| Canary instability leaks into beta         | Keep canary commits separate; require passing tests before promotion. |

## Future Enhancements

- Automate branch creation & exit/enter sequences with a higher-level
  orchestrator action.
- Add SBOM + OSV scan steps to channel workflow for uniform security posture.
- Integrate Slack/Teams notifications on publish outputs.

## References

- **[Pre-Release Guide](./pre-release-guide.md)** - Step-by-step practical guide
- **[Automated Release Workflow](./automated-release-workflow.md)** - Main
  release documentation
- Changesets prerelease docs (`pre enter`, `pre exit`)
- npm dist-tags reference

---

For supply chain security layers see `docs/security-supply-chain.md`.
