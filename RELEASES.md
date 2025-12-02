# Release Playbook (ADHD-friendly)

Quick rules
- Signed commits are optional (signature enforcement is off). Keep signing if you like.
- Pre-mode ON for prerelease channels (`next`, `beta`, `rc`); pre-mode OFF for canary snapshots.
- After any Changesets command that edits files, commit and push so CI matches npm.
- **Trusted Publishing (OIDC)** is the recommended auth method (no tokens needed after setup).

Pre-mode switch
- Enter pre-mode: `bunx changeset pre enter next` (or `beta`/`rc`).
- Exit pre-mode: `bunx changeset pre exit` (required before canary snapshots).
- Pre-mode ON: prerelease version/publish allowed; snapshots blocked.

Before you start (90 seconds)
- Auth check: `gh auth status`; `npm whoami`.
- CI auth: **Trusted Publishing (OIDC)** is preferred - no secrets needed once configured. Fallback: `NPM_TOKEN` secret.
- Clean branch: `git status --short --branch`.
- On the right branch? stay on your feature branch until stable release time.

Pick a path
- Fast canary (npm tag `canary`): follow “Canary”.
- Prerelease channel (`next`/`beta`/`rc`): follow “Prerelease”.
- Stable (`latest`): only when ready; see “Stable”.

Canary (quick experiment)
1) Exit pre-mode: `bunx changeset pre exit`
2) Publish canary: `bunx changeset version --snapshot canary && bunx changeset publish --tag canary`
3) Commit/push the version bumps; optionally re-enter pre-mode: `bunx changeset pre enter next`

Prerelease (next/beta/rc)
1) Enter pre-mode for the channel: `bunx changeset pre enter beta` (or `next`/`rc`)
2) Add changesets.
3) Version bump prerelease: `bunx changeset version:pre` (or `bunx changeset version`)
4) Publish to npm with channel tag: `bunx changeset publish --tag beta` (or `next`/`rc`)
5) Stay in pre-mode until you need a canary or stable.

Stable release
1) Exit pre-mode: `bunx changeset pre exit`
2) Add changesets, then `bunx changeset version`
3) Publish to `latest`: `bunx changeset publish`

Troubleshooting
- “npm ERR! code ENEEDAUTH” during channel release: confirm `NPM_TOKEN` (automation scope) is set in repo secrets; the Channel Release workflow now writes `~/.npmrc` and exports `NODE_AUTH_TOKEN`, but it will still fail if the token is missing/expired.
- “npm ERR! code E404 Not Found - PUT https://registry.npmjs.org/<pkg>”: usually means the token cannot create/publish that package name. Ensure the token belongs to an owner/maintainer for the package (or switch to a scoped name you own, e.g., `@nathanvale/chatline`).
- “Snapshot release is not allowed in pre mode”: exit pre-mode, rerun.
- “Commit must have verified signatures”: signatures are optional now; if re-enabled later, sign locally and push.
- “Checks pending” on automation PRs: run `bun run lint` and `bun run test:ci` locally before pushing.
- Quick status: `git status --short --branch`; auth: `gh auth status`, `npm whoami`.
- “PR checks never started” (automation PRs): push an empty commit to trigger PR workflows: `git commit --allow-empty -m "chore: trigger checks" && git push`.
- “Repo quality failed on .changeset/pre.json”: format locally and push: `bunx biome format .changeset/pre.json` (or `npx biome format …`), then commit and push.

Suggested defaults
- Day-to-day: stay in `next` pre-mode; use `version:pre` + `publish --tag next`.
- Fast experiment: exit pre-mode → canary → re-enter pre-mode.
- Keep this file updated if tags/commands change.

---

## npm Trusted Publishing (OIDC) Setup

**Why?** Eliminates security risks of long-lived tokens. No secrets to leak, rotate, or manage.

**How it works:** GitHub Actions sends a cryptographically-signed OIDC token to npm. npm verifies it's really your repo/workflow, then grants temporary publish access.

**Requirements:**
- npm CLI v11.5.1+ (workflows already use this)
- GitHub-hosted runners (not self-hosted)
- Package must exist on npm before configuring OIDC

### First-time setup (bootstrap)

1. **Create the package on npm** (one-time, use token):
   - Generate a classic **Automation** token at: `npmjs.com/settings/<user>/tokens`
   - Set it as `NPM_TOKEN` secret in GitHub repo settings
   - Run the Channel Release workflow to create the package
   - After first successful publish, proceed to step 2

2. **Configure trusted publisher on npmjs.com:**
   - Go to: `npmjs.com/package/@<scope>/<package>/access`
   - Find "Trusted Publishers" section
   - Add GitHub Actions with:
     - **Owner:** `nathanvale`
     - **Repository:** `chatline`
     - **Workflow filename:** `channel-release.yml` (exact match, case-sensitive!)
     - **Environment:** leave blank

3. **Delete NPM_TOKEN secret** (optional but recommended):
   - Once OIDC is working, remove the token from GitHub secrets
   - Workflows auto-detect OIDC and use it before falling back to tokens

### How workflows handle auth

Workflows now support both auth modes:
1. **OIDC (preferred):** Auto-detected when `id-token: write` permission is set and trusted publisher is configured
2. **NPM_TOKEN (fallback):** Used for bootstrap or if OIDC isn't configured

Check workflow logs for:
- `"No NPM_TOKEN; relying on OIDC trusted publishing."` → OIDC mode
- `"NPM_TOKEN detected; using token auth (fallback mode)."` → Token mode

### Troubleshooting OIDC

- "npm ERR! code ENEEDAUTH": OIDC not configured. Either add `NPM_TOKEN` secret or configure trusted publisher.
- "npm ERR! code E403 Forbidden": Workflow filename mismatch. Double-check exact filename including `.yml` extension.
- "npm ERR! code E404 Not Found": Package doesn't exist yet. Use token for first publish.

---

## Appendix (jargon quick-ref)

- Changesets: tool that tracks pending releases; creates version bumps and publishes to npm.
- Pre-mode: Changesets "prerelease" mode; tags versions with a channel (`next`/`beta`/`rc`), blocks snapshots.
- Canary: snapshot publish with `--snapshot canary` + `--tag canary`; fast, temporary pre-release for testing.
- Channel tags: npm dist-tags like `next`, `beta`, `rc`, `canary` (vs `latest`).
- `version:pre` vs `version`: prerelease vs regular version bump.
- `publish --tag <tag>`: publish to npm under a specific dist-tag; doesn't touch `latest` unless the tag is `latest`.
- Signed commits: commits cryptographically signed (GPG/SSH/trusted). Repo policy currently doesn't enforce signatures; enable if you want stronger provenance.
- Provenance: proof of where a build/release came from (who/what produced it). Stronger when commits are signed and CI is trusted.
- Dist-tag: npm label pointing to a version (e.g., `next`, `beta`, `rc`, `canary`, `latest`). Install picks the tag unless a version is specified.
- Snapshot: temporary version with a unique suffix (canary). Good for quick installs/tests; not intended as stable.
- **OIDC (OpenID Connect):** Industry-standard protocol for identity verification. GitHub Actions can prove its identity to npm without secrets.
- **Trusted Publishing:** npm feature that accepts publishes from verified CI/CD workflows using OIDC. No long-lived tokens needed.
