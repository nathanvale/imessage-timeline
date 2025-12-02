# Release Playbook (ADHD-friendly)

> **Visual learner?** See [RELEASES.mmd](./RELEASES.mmd) for a flowchart diagram.

Quick rules
- Signed commits are optional (signature enforcement is off). Keep signing if you like.
- Pre-mode ON for prerelease channels (`next`, `beta`, `rc`); pre-mode OFF for canary snapshots.
- After any Changesets command that edits files, commit and push so CI matches npm.
- **Trusted Publishing (OIDC)** is the recommended auth method (no tokens needed after setup).
- Build before publish: `bun run build` (or let CI handle it).

Pre-mode switch
- Enter pre-mode: `bunx changeset pre enter next` (or `beta`/`rc`).
- Exit pre-mode: `bunx changeset pre exit` (required before canary snapshots).
- Pre-mode ON: prerelease version/publish allowed; snapshots blocked.

Before you start (90 seconds)
- Auth check: `gh auth status`; `npm whoami`.
- CI auth: **Trusted Publishing (OIDC)** is preferred - no secrets needed once configured. Fallback: `NPM_TOKEN` secret.
- Clean branch: `git status --short --branch`.
- On the right branch? stay on your feature branch until stable release time.

Pre-publish checklist
- Build passes: `bun run build`
- Tests pass: `bun run test:ci`
- Lint clean: `bun run quality-check:ci`
- Check pending changesets: `bunx changeset status`
- Types valid: `bun run check:types` (attw)
- Package hygiene: `bun run check:publint`

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
2) Add changesets: `bunx changeset` (interactive) or `bunx changeset add`
3) Version bump: `bun run version:pre` or `bunx changeset version` (pre-mode auto-adds `-beta.0` suffix)
4) Commit and push: `git add . && git commit -m "chore: version packages" && git push --follow-tags`
5) Publish to npm with channel tag: `bun run publish:pre` or `bunx changeset publish --tag beta`
6) Stay in pre-mode until you need a canary or stable.

Stable release
1) Exit pre-mode: `bunx changeset pre exit`
2) Add changesets, then `bunx changeset version`
3) Publish to `latest`: `bunx changeset publish`

---

## Automation Workflows (GitHub Actions)

Three workflows handle releases. Pick based on your intent:

> **Why these workflows?** See [Additional Resources](#additional-resources) for comparisons of Changesets vs semantic-release vs release-it, and why the community prefers this approach.

### 1. Auto-Publish on Main (changesets-manage-publish.yml)

**When it runs**: Automatic on every push to `main` + manual trigger
**What it does**:
- If changesets exist → Opens/updates "Version Packages" PR
- If PR is merged → Auto-publishes to npm with provenance

**How to use**:
1. Create feature branch, add changesets: `bunx changeset`
2. Push and merge PR to `main`
3. Bot creates "Version Packages" PR automatically
4. Auto-merge enabled by `version-packages-auto-merge.yml` workflow
5. **If PR is stuck**: Required status checks may block merge (see [Troubleshooting](#troubleshooting))
6. Review and merge "Version Packages" PR (or manually merge if blocked)
7. Bot publishes to npm (uses OIDC trusted publishing)

**When to use**: Default workflow for stable releases. Fully automated after initial changeset.

**Notes**:
- Runs quality checks (`bun run quality-check:ci`) before versioning
- Uses Node 24 for npm 11.6+ (OIDC support)
- Skips publish if no NPM_TOKEN and OIDC not configured (safety guard)
- Companion workflow `version-packages-auto-merge.yml` enables auto-merge on bot PRs
- **Known limitation**: Bot PRs don't trigger required status check workflows - see Troubleshooting

---

### 2. Manual Channel Release (channel-release.yml)

**When it runs**: Manual workflow_dispatch only
**What it does**: Three modes (version | publish | snapshot)
- **version**: Bump prerelease version (e.g., `1.0.0-next.0` → `1.0.0-next.1`)
- **publish**: Publish current version to channel tag (next/beta/rc)
- **snapshot**: Create and publish canary snapshot

**How to use**:

**Prerelease version bump**:
1. Actions → "Channel Release (manual)"
2. Channel: `next` (or beta/rc)
3. Intent: `version`
4. Run workflow → commits version bump to your branch

**Prerelease publish**:
1. Ensure pre-mode is active (`.changeset/pre.json` exists)
2. Actions → "Channel Release (manual)"
3. Channel: `next` (or beta/rc)
4. Intent: `publish`
5. Run workflow → publishes to npm with `--tag next`

**Canary snapshot**:
1. Actions → "Channel Release (manual)"
2. Channel: `canary`
3. Intent: `snapshot`
4. Run workflow → creates snapshot version (e.g., `0.0.0-canary-20241203`) and publishes

**When to use**:
- Prerelease testing (next/beta/rc channels)
- Quick canary builds for testing
- Manual control over timing

**Notes**:
- Validates pre-mode state before version/publish (fails if not in pre-mode)
- Runs quality checks + build before publish
- Uses OIDC trusted publishing (NPM_TOKEN fallback)

---

### 3. Manual Stable Release (release.yml)

**When it runs**: Manual workflow_dispatch only
**What it does**: Full release with quality checks
- Runs `quality-check:ci`
- Builds package
- Generates SBOM (Software Bill of Materials)
- Publishes to npm `latest` tag

**How to use**:
1. Exit pre-mode: `bunx changeset pre exit`
2. Actions → "Release"
3. Run workflow
4. Publishes to npm

**When to use**:
- Manual stable releases when you don't want auto-publish
- Initial setup testing
- Emergency releases

**Notes**:
- Currently manual-only to avoid accidental publish on initial main push
- Can be converted to automatic by changing trigger to `push: { branches: [main] }`

---

## Workflow Status (OIDC Trusted Publishing)

| Workflow | Trusted Publisher | Notes |
|----------|-------------------|-------|
| `channel-release.yml` | ✅ Configured | Manual channel releases (next/beta/rc/canary) |
| `changesets-manage-publish.yml` | ✅ Configured | Auto "Version Packages" PR + publish on merge |
| `release.yml` | ✅ Configured | Manual stable releases |
| `alpha-snapshot.yml` | ⏳ Add when needed | Daily alpha snapshots |

To add more workflows: npmjs.com → package Settings → Trusted Publisher → Add another connection.

---

Troubleshooting
- “npm ERR! code ENEEDAUTH” during channel release: confirm `NPM_TOKEN` (automation scope) is set in repo secrets; the Channel Release workflow now writes `~/.npmrc` and exports `NODE_AUTH_TOKEN`, but it will still fail if the token is missing/expired.
- “npm ERR! code E404 Not Found - PUT https://registry.npmjs.org/<pkg>”: usually means the token cannot create/publish that package name. Ensure the token belongs to an owner/maintainer for the package (or switch to a scoped name you own, e.g., `@nathanvale/chatline`).
- “Snapshot release is not allowed in pre mode”: exit pre-mode, rerun.
- “Commit must have verified signatures”: signatures are optional now; if re-enabled later, sign locally and push.
- “Checks pending” on automation PRs: run `bun run lint` and `bun run test:ci` locally before pushing.
- Quick status: `git status --short --branch`; auth: `gh auth status`, `npm whoami`.
- “PR checks never started” (automation PRs): push an empty commit to trigger PR workflows: `git commit --allow-empty -m "chore: trigger checks" && git push`.
- "Repo quality failed on .changeset/pre.json": format locally and push: `bunx biome format .changeset/pre.json` (or `npx biome format …`), then commit and push.
- "Version Packages" PR stuck (no status checks running): Bot PRs don't trigger workflows due to GitHub security. The `version-packages-auto-merge.yml` workflow enables auto-merge, but required status checks (`commitlint`, `lint`, `All checks passed`) still block the merge. **Solutions**: (1) Remove these checks from branch protection for bot PRs, (2) Manually approve: `gh pr review 51 --approve && gh pr merge 51 --squash`, or (3) Use a PAT with `workflow` scope instead of `GITHUB_TOKEN` in changesets-manage-publish.yml.

Suggested defaults
- Day-to-day: stay in `next` pre-mode; use `changeset version` + `changeset publish --tag next`.
- Fast experiment: exit pre-mode → canary → re-enter pre-mode.
- Keep this file updated if tags/commands change.

---

## npm Trusted Publishing (OIDC) Setup

**Why?** Eliminates security risks of long-lived tokens. No secrets to leak, rotate, or manage.

**Industry standard:** PyPI, RubyGems, npm all support OIDC. Classic tokens deprecated Dec 9, 2025. See [Trusted Publishing References](#trusted-publishing-references) for official docs and security best practices.

**How it works:** GitHub Actions sends a cryptographically-signed OIDC token to npm. npm verifies it's really your repo/workflow, then grants temporary publish access.

**Requirements:**
- **Node 24+** (critical: Node 22 ships npm 10.9.4 which gives 404s; Node 24 ships npm 11.6+ which works)
- GitHub-hosted runners (self-hosted not yet supported)
- Package must exist on npm before configuring OIDC
- `id-token: write` permission in workflow

**Note:** Classic tokens are deprecated. Existing classic tokens will be revoked **December 9, 2025**. Migrate to trusted publishing or granular access tokens.

### Current status

| Workflow | Trusted Publisher | Notes |
|----------|-------------------|-------|
| `channel-release.yml` | ✅ Configured | Manual channel releases (next/beta/rc/canary) |
| `changesets-manage-publish.yml` | ⏳ Add when needed | Auto-publish on main merge |
| `release.yml` | ⏳ Add when needed | Manual stable releases |
| `alpha-snapshot.yml` | ⏳ Add when needed | Daily alpha snapshots |

To add more workflows: npmjs.com → package Settings → Trusted Publisher → Add another connection.

### First-time setup (bootstrap) ✅ DONE

1. **Create the package on npm** ✅:
   - Package `@nathanvale/chatline` created via local `npm publish --tag canary`
   - Bootstrap publish used NPM_TOKEN (one-time)

2. **Configure trusted publisher on npmjs.com** ✅:
   - Go to: [npmjs.com/package/@nathanvale/chatline/access](https://www.npmjs.com/package/@nathanvale/chatline/access)
   - Settings → Trusted Publisher section
   - Added GitHub Actions with:
     - **Owner:** `nathanvale`
     - **Repository:** `chatline`
     - **Workflow filename:** `channel-release.yml`
     - **Environment:** (blank)

3. **Delete NPM_TOKEN secret** (optional but recommended):
   - Once OIDC is verified working, remove the token from GitHub secrets
   - Workflows auto-detect OIDC and use it before falling back to tokens

### How workflows handle auth

Workflows now support both auth modes:
1. **OIDC (preferred):** Auto-detected when `id-token: write` permission is set and trusted publisher is configured
2. **NPM_TOKEN (fallback):** Used for bootstrap or if OIDC isn't configured

**Provenance is automatic:** With trusted publishing, npm CLI publishes provenance attestations by default. The `--provenance` flag is no longer needed.

Check workflow logs for:
- `"No NPM_TOKEN; relying on OIDC trusted publishing."` → OIDC mode
- `"NPM_TOKEN detected; using token auth (fallback mode)."` → Token mode

### Troubleshooting OIDC

- "npm ERR! code ENEEDAUTH": OIDC not configured. Either add `NPM_TOKEN` secret or configure trusted publisher.
- "npm ERR! code E403 Forbidden": Workflow filename mismatch. Double-check exact filename including `.yml` extension.
- "npm ERR! code E404 Not Found": Package doesn't exist yet. Use token for first publish.

---

## Changeset Configuration (.changeset/config.json)

> **Why Changesets?** This tool is the community favorite for monorepos (used by Chakra UI, Remix, Astro, SvelteKit). See [Additional Resources](#additional-resources) for detailed comparisons.

Your current config:

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "access": "public",                    // Required for scoped packages (@nathanvale/chatline)
  "baseBranch": "main",                  // Target branch for version PRs
  "changelog": [
    "@changesets/changelog-github",      // Creates rich GitHub release notes
    { "repo": "nathanvale/chatline" }
  ],
  "commit": false,                       // Manual commits (not auto-commit)
  "packages": [".", "website"],          // Workspaces to version
  "fixed": [],                           // Packages that always version together
  "ignore": [],                          // Packages to exclude from versioning
  "linked": [],                          // Packages with related versions
  "updateInternalDependencies": "patch"  // Bump internal deps as patch versions
}
```

**Key settings explained**:

| Setting | Value | Why |
|---------|-------|-----|
| `access` | `"public"` | Scoped packages (`@nathanvale/*`) are private by default. This forces public. |
| `baseBranch` | `"main"` | Changesets targets this branch for version PRs. |
| `changelog` | GitHub integration | Auto-generates changelog with GitHub usernames, PR links, commit links. |
| `commit` | `false` | You manually commit version bumps (aligns with git safety workflow). |
| `packages` | `[".", "website"]` | Versions both root package and website workspace. |
| `updateInternalDependencies` | `"patch"` | When package A depends on package B, bump A's dep on B as patch. |

**When to modify**:
- **Add `fixed`**: If you want multiple packages to always have the same version (e.g., `["package-a", "package-b"]`)
- **Add `linked`**: If packages should increment together but can have different versions
- **Change `commit` to `true`**: If you want Changesets to auto-commit version bumps (not recommended with pre-commit hooks)
- **Add to `ignore`**: If you have packages that should never be versioned (e.g., private tooling)

**Testing config changes**:
1. Edit `.changeset/config.json`
2. Run `bunx changeset status` to verify it parses correctly
3. Test with `bunx changeset version --snapshot test` (dry-run)

---

## Appendix (jargon quick-ref)

- Changesets: tool that tracks pending releases; creates version bumps and publishes to npm.
- Pre-mode: Changesets "prerelease" mode; tags versions with a channel (`next`/`beta`/`rc`), blocks snapshots.
- Canary: snapshot publish with `--snapshot canary` + `--tag canary`; fast, temporary pre-release for testing.
- Channel tags: npm dist-tags like `next`, `beta`, `rc`, `canary` (vs `latest`).
- `version --snapshot`: creates temporary snapshot versions (e.g., `0.0.0-canary-20241203`); use outside pre-mode.
- `version` (in pre-mode): creates prerelease versions with incrementing suffix (e.g., `1.0.0-beta.0`, `1.0.0-beta.1`).
- `publish --tag <tag>`: publish to npm under a specific dist-tag; doesn't touch `latest` unless the tag is `latest`.
- Signed commits: commits cryptographically signed (GPG/SSH/trusted). Repo policy currently doesn't enforce signatures; enable if you want stronger provenance.
- Provenance: proof of where a build/release came from (who/what produced it). Stronger when commits are signed and CI is trusted.
- Dist-tag: npm label pointing to a version (e.g., `next`, `beta`, `rc`, `canary`, `latest`). Install picks the tag unless a version is specified.
- Snapshot: temporary version with a unique suffix (canary). Good for quick installs/tests; not intended as stable.
- **OIDC (OpenID Connect):** Industry-standard protocol for identity verification. GitHub Actions can prove its identity to npm without secrets.
- **Trusted Publishing:** npm feature that accepts publishes from verified CI/CD workflows using OIDC. No long-lived tokens needed.

### Trusted Publishing References

**Official Documentation**:
- [npm Trusted Publishing Docs](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Changelog - npm trusted publishing GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [Socket.dev - npm Trusted Publishing](https://socket.dev/blog/npm-trusted-publishing)

**Security Best Practices**:
- [Snyk: Modern npm Package Best Practices 2025](https://snyk.io/blog/best-practices-create-modern-npm-package/)
- [OpenSSF: Trusted Publishers Standard](https://repos.openssf.org/trusted-publishers-for-all-package-repositories)

---

## Additional Resources

### Changesets vs Alternatives

**Why Changesets?**
- [Changesets vs Semantic Release - Brian Schiller](https://brianschiller.com/blog/2023/09/18/changesets-vs-semantic-release/)
  - State in files vs git tags
  - Easy to edit before release
  - Better for monorepos
- [Ultimate Guide to NPM Release Automation - Oleksii Popov](https://oleksiipopov.com/blog/npm-release-automation/)
  - Compares Semantic Release, Release Please, Changesets
  - Complete setup guides and workflows
- [Release Management for NX Monorepos - Hamza K](https://www.hamzak.xyz/blog-posts/release-management-for-nx-monorepos-semantic-release-vs-changesets-vs-release-it-)
  - Tool comparison for monorepo environments
  - Conventional commits vs changesets

**Tool Comparisons**:
- [npm-trends: changesets vs release-it vs semantic-release](https://npmtrends.com/changesets-vs-release-it-vs-semantic-release)
  - Download stats and popularity trends
- [Introducing Changesets - Liran Tal](https://lirantal.com/blog/introducing-changesets-simplify-project-versioning-with-semantic-releases)
  - Why projects migrate from semantic-release

### Monorepo & Workspace Management

**pnpm Workspaces** (if you migrate from Bun):
- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
  - Workspace protocol (`workspace:`)
  - Monorepo best practices
- [Exploring the Monorepo: Workspaces - Jon Lauridsen](https://dev.to/jonlauridsen/attempt-2-workspaces-npm-pnpm-336a)
  - Practical guide to pnpm workspaces

### Publishing Guides

**Modern npm Publishing**:
- [Publishing Your First NPM Package - Mir Mursalin](https://dev.to/mir_mursalin_ankur/publishing-your-first-npm-package-a-real-world-guide-that-actually-helps-4l4)
  - Updated for 2025 npm changes
  - Scoped packages, OIDC setup
- [Complete Guide to Publishing npm Package - Chan Meng](https://chanmeng666.medium.com/a-complete-guide-to-publishing-your-first-npm-package-466fbf919ee9)
  - Real-world example walkthrough
