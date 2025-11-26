# Pre-Release Guide - Canary, Beta, and RC Releases

> **Current Status**: Pre-release mode **ACTIVE** with `next` channel (canary
> releases) at version `0.0.1`

This guide explains how to publish pre-release versions of `imessage-timeline`
for testing, early access, and staged rollouts.

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Understanding Pre-Release Modes](#understanding-pre-release-modes)
- [Current Setup](#current-setup)
- [How to Toggle Pre-Release Mode](#how-to-toggle-pre-release-mode)
- [Publishing Options](#publishing-options)
- [Common Workflows](#common-workflows)
- [Channel Strategy](#channel-strategy)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference

### I Want To...

| Goal                                | Command                                                          | Prerequisites                     | What It Does                                                        |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| **Publish a quick snapshot build**  | `pnpm release:snapshot:canary`                                   | ⚠️ **Must NOT be in pre-mode**    | Instant publish as `0.0.1-canary-20251116001234` with `@canary` tag |
| **Publish a proper canary release** | `pnpm changeset` → `pnpm changeset version` → `pnpm publish:pre` | ✅ **Must be in pre-mode (next)** | Versioned release as `0.0.1-next.0` with `@next` tag                |
| **Enter beta mode**                 | `gh workflow run pre-mode.yml -f action=enter -f channel=beta`   | -                                 | Switch to `beta` channel for `0.0.1-beta.0` releases                |
| **Exit pre-release mode**           | `gh workflow run pre-mode.yml -f action=exit -f channel=next`    | -                                 | Return to normal stable releases                                    |
| **Check current mode**              | `cat .changeset/pre.json`                                        | -                                 | Shows current pre-release configuration (file exists = pre-mode ON) |

---

## Understanding Pre-Release Modes

### What is Pre-Release Mode?

Pre-release mode tells Changesets to **add a suffix** to versions when
publishing. This allows you to:

- Test features without affecting stable users
- Gather feedback before final release
- Provide early access to new features
- Stage releases through channels (canary → beta → rc → stable)

### Pre-Release vs Normal Mode

```
NORMAL MODE (OFF):
├─ Changesets create: 0.0.1, 0.0.2, 0.0.3
├─ Published with tag: @latest
└─ Users install: npm install imessage-timeline

PRE-RELEASE MODE (ON - next channel):
├─ Changesets create: 0.0.1-next.0, 0.0.1-next.1, 0.0.1-next.2
├─ Published with tag: @next
└─ Users install: npm install imessage-timeline@next
```

### When Pre-Release Mode is On

- ✅ File `.changeset/pre.json` exists
- ✅ Versions get suffixes: `-next.0`, `-beta.1`, `-rc.2`
- ✅ Published to dist-tag matching channel (`next`, `beta`, `rc`)
- ✅ Stable users unaffected (they still get `@latest`)

### When Pre-Release Mode is Off

- ❌ File `.changeset/pre.json` doesn't exist
- ✅ Versions are normal: `0.0.1`, `0.0.2`, `0.0.3`
- ✅ Published to `@latest` tag
- ✅ Default behavior for production releases

---

## Current Setup

### Status

```json
{
  "changesets": [],
  "initialVersions": {
    "imessage-timeline": "0.0.1"
  },
  "mode": "pre",
  "tag": "next"
}
```

**What this means:**

- ✅ Pre-release mode is **ACTIVE**
- ✅ Channel: `next` (canary releases)
- ✅ Base version: `0.0.1`
- ✅ Next version will be: `0.0.1-next.0`

### Configured Workflows

| Workflow                        | Purpose                     | When It Runs                              |
| ------------------------------- | --------------------------- | ----------------------------------------- |
| `pre-mode.yml`                  | Enter/exit pre-release mode | Manual trigger only                       |
| `alpha-snapshot.yml`            | Nightly canary snapshots    | Daily at 02:00 UTC (when pre-mode active) |
| `changesets-manage-publish.yml` | Normal version/publish flow | On push to main                           |

---

## How to Toggle Pre-Release Mode

### Turning Pre-Release Mode ON

**Command:**

```bash
gh workflow run pre-mode.yml -f action=enter -f channel=next
```

**What happens:**

1. Workflow creates branch: `pre/enter-next-{run-id}`
2. Creates `.changeset/pre.json` file
3. Opens PR: "chore(pre): enter next channel"
4. After PR merges → Pre-release mode is active

**Available channels:**

- `next` - For canary/nightly releases (fast iteration)
- `beta` - For beta testing (feature complete)
- `rc` - For release candidates (final testing)

### Turning Pre-Release Mode OFF

**Command:**

```bash
gh workflow run pre-mode.yml -f action=exit -f channel=next
```

**What happens:**

1. Workflow creates branch: `pre/exit-next-{run-id}`
2. Deletes `.changeset/pre.json` file
3. Opens PR: "chore(pre): exit next channel"
4. After PR merges → Back to normal stable releases

### Checking Current Status

**Quick check:**

```bash
# If this file exists, pre-release mode is ON
cat .changeset/pre.json

# If file doesn't exist, pre-release mode is OFF
```

**View details:**

```bash
cat .changeset/pre.json | jq '.'
# Output shows: mode, tag, initialVersions
```

---

## Publishing Options

### Option 1: Snapshot Release (Quick & Dirty)

> ⚠️ **IMPORTANT:** Snapshot releases do NOT work when in pre-release mode.
>
> If `.changeset/pre.json` exists (pre-mode is active), you will get this error:
>
> ```
> 🦋 error Snapshot release is not allowed in pre mode
> ```
>
> **To use snapshots:** Exit pre-release mode first with:
>
> ```bash
> gh workflow run pre-mode.yml -f action=exit -f channel=next
> ```
>
> **Alternative:** Use versioned pre-releases (Option 2) instead.

**Use when:**

- You need to test something RIGHT NOW without version tracking
- You are **NOT in pre-release mode** (no `.changeset/pre.json` file)

**Command:**

```bash
pnpm release:snapshot:canary
```

**What it does:**

- ✅ **No changeset needed** - publishes immediately
- ✅ Creates timestamp-based version: `0.0.1-canary-20251116001234`
- ✅ Publishes to npm with `@canary` tag
- ❌ **No git commit** - not tracked in version history
- ❌ **No CHANGELOG entry** - ephemeral release
- ⚠️ **Only works when NOT in pre-mode** - Changesets limitation

**Version format:**

```
0.0.1-canary-20251116001234
       ^^^^^^ ^^^^^^^^^^^^^^
       tag    timestamp (YYYYMMDDHHmmSS)
```

**Users install:**

```bash
npm install imessage-timeline@canary
# or pin specific version:
npm install imessage-timeline@0.0.1-canary-20251116001234
```

**When to use:**

- Quick bug fix validation
- Sharing work-in-progress with team
- CI/CD integration testing
- Throwaway experimental builds

---

### Option 2: Versioned Pre-Release (Proper)

**Use when:** You want tracked, proper pre-release versions for beta/rc cycles.

**Steps:**

1. **Create changeset:**

   ```bash
   pnpm changeset
   # Select: imessage-timeline
   # Bump: patch/minor/major (determines final version)
   # Summary: "Add new experimental feature"
   ```

2. **Version the package:**

   ```bash
   pnpm changeset version
   # Creates: 0.0.1-next.0 (if in next channel)
   # Updates: CHANGELOG.md with entry
   # Deletes: consumed changeset files
   ```

3. **Commit the version:**

   ```bash
   git add .
   git commit -m "chore: version 0.0.1-next.0"
   git push origin main
   ```

4. **Publish to npm:**
   ```bash
   pnpm publish --tag next
   # Publishes to npm with @next dist-tag
   ```

**Version progression:**

```
First pre-release:  0.0.1-next.0
Second pre-release: 0.0.1-next.1
Third pre-release:  0.0.1-next.2
...
Exit pre-mode:      0.0.1 (stable)
```

**Users install:**

```bash
npm install imessage-timeline@next
# or pin specific version:
npm install imessage-timeline@0.0.1-next.0
```

**When to use:**

- Structured beta testing
- Release candidates
- Multi-week pre-release cycles
- When you need version tracking in CHANGELOG

---

### Option 3: Automated Nightly (Hands-Off)

**Use when:** You want automatic daily canary builds.

**Setup:**

- ✅ **Already configured** - `alpha-snapshot.yml` workflow
- ✅ Runs daily at **02:00 UTC**
- ✅ Only runs when **pre-release mode is active**
- ✅ Publishes with `@alpha` tag

**What it does:**

1. Checks if `.changeset/pre.json` exists
2. If pre-mode is active:
   - Runs `changeset version --snapshot alpha`
   - Creates version like: `0.0.1-alpha-20251116020000`
   - Publishes to npm with `@alpha` tag
3. If pre-mode is off:
   - Skips publishing (prevents confusion)

**Users install:**

```bash
npm install imessage-timeline@alpha
```

**When to use:**

- Continuous testing environments
- Automated QA pipelines
- Night owls who want fresh builds daily
- "Living on the edge" early adopters

---

## Common Workflows

### Workflow 1: Quick Pre-Release for Testing (In Pre-Mode)

**Scenario:** You fixed a bug and want to test it immediately (while in
pre-mode).

```bash
# 1. Commit your fix to main
git add .
git commit -m "fix: resolve critical bug"
git push origin main

# 2. Create changeset for the fix
pnpm changeset
# Select: imessage-timeline
# Bump: patch
# Summary: "Fix critical bug"

# 3. Version the pre-release
pnpm changeset version
# Creates: 0.0.1-next.0 (or next increment)

# 4. Commit the version
git commit -am "chore: version 0.0.1-next.0"
git push origin main

# 5. Publish to npm
pnpm publish:pre

# 6. Test it
npm install imessage-timeline@next
# Run your tests...
```

**Alternative: Quick Snapshot (NOT in pre-mode)**

If you're NOT in pre-release mode and need instant publish:

```bash
# 1. Commit your fix
git commit -am "fix: resolve critical bug"

# 2. Publish snapshot (only works if NOT in pre-mode)
pnpm release:snapshot:canary

# 3. Test it
npm install imessage-timeline@canary
```

---

### Workflow 2: Structured Beta Cycle

**Scenario:** You're preparing a 0.1.0 release with new features.

```bash
# 1. Enter beta mode
gh workflow run pre-mode.yml -f action=enter -f channel=beta
# Merge the PR that gets created

# 2. Add features with changesets
pnpm changeset  # For each feature
git commit -am "chore: add changeset"

# 3. Version and publish beta.0
pnpm changeset version  # Creates 0.1.0-beta.0
git commit -am "chore: version 0.1.0-beta.0"
pnpm publish --tag beta

# 4. Iterate (fixes, more features)
pnpm changeset  # For each change
pnpm changeset version  # Creates 0.1.0-beta.1, beta.2, etc.
git commit -am "chore: version 0.1.0-beta.1"
pnpm publish --tag beta

# 5. Exit beta when ready for stable
gh workflow run pre-mode.yml -f action=exit -f channel=beta
# Merge the PR

# 6. Final stable release
pnpm changeset version  # Creates 0.1.0 (stable)
git commit -am "chore: version 0.1.0"
pnpm publish  # Publishes to @latest (default)
```

---

### Workflow 3: Multi-Channel Promotion

**Scenario:** You want to graduate a release through next → beta → rc → stable.

```bash
# Stage 1: Canary (next channel)
gh workflow run pre-mode.yml -f action=enter -f channel=next
# ... merge PR ...
pnpm changeset version  # 0.1.0-next.0
pnpm publish --tag next
# ... test with early adopters ...

# Stage 2: Beta
gh workflow run pre-mode.yml -f action=exit -f channel=next
# ... merge PR ...
gh workflow run pre-mode.yml -f action=enter -f channel=beta
# ... merge PR ...
pnpm changeset version  # 0.1.0-beta.0
pnpm publish --tag beta
# ... broader testing ...

# Stage 3: Release Candidate
gh workflow run pre-mode.yml -f action=exit -f channel=beta
# ... merge PR ...
gh workflow run pre-mode.yml -f action=enter -f channel=rc
# ... merge PR ...
pnpm changeset version  # 0.1.0-rc.0
pnpm publish --tag rc
# ... final validation ...

# Stage 4: Stable Release
gh workflow run pre-mode.yml -f action=exit -f channel=rc
# ... merge PR ...
pnpm changeset version  # 0.1.0
pnpm publish  # @latest
```

---

## Channel Strategy

### Channel Comparison

| Channel    | Tag       | Stability   | Frequency           | Use Case                         |
| ---------- | --------- | ----------- | ------------------- | -------------------------------- |
| **canary** | `@canary` | Unstable    | On-demand snapshots | Quick testing, WIP shares        |
| **next**   | `@next`   | Unstable    | Daily or as-needed  | Fast iteration, early adopters   |
| **alpha**  | `@alpha`  | Unstable    | Nightly (02:00 UTC) | Automated QA, continuous testing |
| **beta**   | `@beta`   | Semi-stable | Weekly sprints      | Feature-complete testing         |
| **rc**     | `@rc`     | Stable      | Pre-release only    | Final validation before release  |
| **latest** | `@latest` | Stable      | Production releases | End users                        |

### Recommended Strategy

**For rapid iteration:**

```
Development → next (canary) → latest (stable)
```

**For structured releases:**

```
Development → beta → rc → latest
```

**For continuous delivery:**

```
Development → next → alpha (nightly) → beta → latest
```

**Current setup (recommended for initial releases):**

```
Development → next → latest
         (canary mode)  (first stable release)
```

---

## Troubleshooting

### Problem: Pre-mode workflow fails with "no changes to commit"

**Cause:** The workflow already ran and pre-mode is already active/inactive.

**Solution:**

```bash
# Check current status
cat .changeset/pre.json

# If file exists, you're in pre-mode
# If file doesn't exist, you're in normal mode
```

---

### Problem: Published to wrong tag

**Symptom:** Published to `@latest` instead of `@next`

**Cause:** Didn't specify `--tag` flag when publishing.

**Solution:**

```bash
# Always specify tag when in pre-mode
pnpm publish --tag next  # For next channel
pnpm publish --tag beta  # For beta channel
pnpm publish --tag rc    # For rc channel

# For stable releases (no pre-mode)
pnpm publish  # Defaults to @latest
```

---

### Problem: Snapshot doesn't work

**Error:** `changeset version --snapshot` fails with:

```
🦋 error Snapshot release is not allowed in pre mode
🦋 To resolve this exit the pre mode by running `changeset pre exit`
```

**Cause:** You're in pre-release mode. Changesets does NOT support snapshots
when `.changeset/pre.json` exists.

**Solution:**

**Option 1: Exit pre-mode to use snapshots**

```bash
# Exit pre-release mode
gh workflow run pre-mode.yml -f action=exit -f channel=next
# Wait for PR to be created and merged

# Then snapshots will work
pnpm release:snapshot:canary
```

**Option 2: Use versioned pre-releases instead (recommended)**

```bash
# Stay in pre-mode and use proper versioned pre-releases
pnpm changeset           # Create changeset
pnpm changeset version   # Creates 0.0.1-next.0
pnpm publish:pre         # Publish to @next tag
```

**Note:** Snapshots only work when NOT in pre-release mode. This is a Changesets
limitation, not a configuration issue.

---

### Problem: Can't exit pre-mode

**Error:** Workflow succeeds but still in pre-mode

**Cause:** PR wasn't merged, or file was recreated.

**Solution:**

```bash
# Verify PR merged
gh pr list --state merged --search "exit next channel"

# If merged but file still exists, manually remove
git rm .changeset/pre.json
git commit -m "chore: exit pre-release mode manually"
git push origin main
```

---

### Problem: Version number is wrong

**Symptom:** Expected `0.0.1-next.0` but got `0.0.2-next.0`

**Cause:** Base version in `pre.json` doesn't match `package.json`

**Solution:**

```bash
# Check versions match
cat package.json | grep version
cat .changeset/pre.json | grep initialVersions

# If mismatched, exit and re-enter pre-mode
gh workflow run pre-mode.yml -f action=exit -f channel=next
# ... merge PR ...
gh workflow run pre-mode.yml -f action=enter -f channel=next
# ... merge PR ...
```

---

## Additional Resources

### Related Documentation

- [Automated Release Workflow](./automated-release-workflow.md) - Main release
  documentation
- [Release Channels](./release-channels.md) - Channel strategy deep-dive
- [Changesets Canonical Flow](./releases/changesets-canonical.md) - Quick
  reference

### External Links

- [Changesets Pre-release Docs](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
- [npm dist-tags](https://docs.npmjs.com/cli/v9/commands/npm-dist-tag)
- [Semantic Versioning](https://semver.org/)

### Package Scripts Reference

```json
{
  "pre:enter:beta": "changeset pre enter beta",
  "pre:enter:next": "changeset pre enter next",
  "pre:enter:rc": "changeset pre enter rc",
  "pre:exit": "changeset pre exit",
  "publish:pre": "changeset publish --provenance",
  "release:snapshot:canary": "changeset version --snapshot canary && changeset publish --tag canary",
  "version:pre": "changeset version"
}
```

---

## Summary

**Pre-release mode is:**

- A way to publish test versions without affecting stable users
- Controlled by the presence of `.changeset/pre.json` file
- Toggled using the `pre-mode.yml` workflow (creates PRs for review)
- Used for canary, beta, and RC releases before stable

**Publishing options:**

1. **Snapshot** (`pnpm release:snapshot:canary`) - Quick, throwaway builds
2. **Versioned** (`pnpm changeset version && pnpm publish --tag next`) - Tracked
   pre-releases
3. **Automated** (nightly workflow) - Hands-off daily builds

**Current setup:**

- ✅ Pre-release mode active with `next` channel
- ✅ Base version: `0.0.1`
- ✅ Nightly snapshots configured
- ✅ Ready for first canary release!

---

**Last Updated:** 2025-11-16 **Status:** Active (next mode at 0.0.1)
