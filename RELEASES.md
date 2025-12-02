# Release Playbook (ADHD-friendly)

Quick rules
- Signed commits are optional (signature enforcement is off). Keep signing if you like.
- Pre-mode ON for prerelease channels (`next`, `beta`, `rc`); pre-mode OFF for canary snapshots.
- After any Changesets command that edits files, commit and push so CI matches npm.

Pre-mode switch
- Enter pre-mode: `bunx changeset pre enter next` (or `beta`/`rc`).
- Exit pre-mode: `bunx changeset pre exit` (required before canary snapshots).
- Pre-mode ON: prerelease version/publish allowed; snapshots blocked.

Before you start (90 seconds)
- Auth check: `gh auth status`; `npm whoami`.
- CI auth: ensure repo has `NPM_TOKEN` secret and Actions can publish. Manual channel releases now write `~/.npmrc` automatically.
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

Appendix (jargon quick-ref)
- Changesets: tool that tracks pending releases; creates version bumps and publishes to npm.
- Pre-mode: Changesets “prerelease” mode; tags versions with a channel (`next`/`beta`/`rc`), blocks snapshots.
- Canary: snapshot publish with `--snapshot canary` + `--tag canary`; fast, temporary pre-release for testing.
- Channel tags: npm dist-tags like `next`, `beta`, `rc`, `canary` (vs `latest`).
- `version:pre` vs `version`: prerelease vs regular version bump.
- `publish --tag <tag>`: publish to npm under a specific dist-tag; doesn’t touch `latest` unless the tag is `latest`.
- Signed commits: commits cryptographically signed (GPG/SSH/trusted). Repo policy currently doesn’t enforce signatures; enable if you want stronger provenance.
- Provenance: proof of where a build/release came from (who/what produced it). Stronger when commits are signed and CI is trusted.
- Dist-tag: npm label pointing to a version (e.g., `next`, `beta`, `rc`, `canary`, `latest`). Install picks the tag unless a version is specified.
- Snapshot: temporary version with a unique suffix (canary). Good for quick installs/tests; not intended as stable.
