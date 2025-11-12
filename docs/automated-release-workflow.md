# Automated Release Workflow

> **Status**: ✅ **FULLY CONFIGURED** - This project has a production-ready
> automated release workflow with Changesets, conventional commits, and Git
> hooks.

## Table of Contents

- [Overview](#overview)
- [Current Configuration](#current-configuration)
- [Workflow Architecture](#workflow-architecture)
- [Developer Workflow](#developer-workflow)
- [Conventional Commits](#conventional-commits)
- [Changesets Usage](#changesets-usage)
- [Git Hooks](#git-hooks)
- [CI/CD Pipeline](#cicd-pipeline)
- [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

This project uses a comprehensive automated release workflow that ensures:

- **Quality commits**: Conventional commit validation with commitlint + Husky
- **Semantic versioning**: Automated version bumps based on changeset types
- **Automated changelogs**: GitHub-integrated changelog generation
- **Safe releases**: Pre-publish quality checks and build verification
- **Provenance**: NPM provenance for supply chain security

### Technology Stack

| Tool                             | Purpose                                   | Version          |
| -------------------------------- | ----------------------------------------- | ---------------- |
| **Changesets**                   | Version management & changelog generation | 1.0.2            |
| **commitlint**                   | Conventional commit enforcement           | 20.1.0           |
| **Husky**                        | Git hooks (commit-msg, pre-commit)        | 9.1.7            |
| **@changesets/action**           | GitHub Actions integration                | v1               |
| **@changesets/changelog-github** | GitHub-linked changelogs                  | (via changesets) |

---

## Current Configuration

### ✅ What's Already Set Up

#### 1. Changesets Configuration (`.changeset/config.json`)

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "access": "public",
  "baseBranch": "main",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "nathanvale/imessage-timeline" }
  ],
  "commit": false,
  "fixed": [],
  "ignore": [],
  "linked": [],
  "updateInternalDependencies": "patch"
}
```

**Key Settings:**

- ✅ Public NPM package (`access: "public"`)
- ✅ GitHub-integrated changelogs with PR/author links
- ✅ Main branch as release branch
- ✅ No automatic commits (manual control)

#### 2. Commitlint Configuration (`commitlint.config.mjs`)

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
}
```

**Enforces:**

- Conventional Commits specification
- Valid commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
  `test`, `build`, `ci`, `chore`, `revert`
- Commit message format: `<type>(<scope>): <subject>`

#### 3. Husky Git Hooks (`.husky/`)

**`.husky/commit-msg`:**

```bash
pnpm commitlint -- --edit $1
```

**`.husky/pre-commit`:**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
pnpm quality-check --staged --fix
```

**Validates:**

- ✅ Commit messages follow conventional commits
- ✅ Staged files are linted and formatted
- ✅ Code quality checks pass before commit

#### 4. GitHub Actions Workflows

**`.github/workflows/release.yml`:**

- Triggers on push to `main` or manual workflow dispatch
- Runs quality checks, builds, and publishes via Changesets
- Uses NPM provenance for supply chain security

**`.github/workflows/commitlint.yml`:**

- Validates commit messages on PRs and main branch pushes
- Ensures all commits follow conventional format

#### 5. Package.json Scripts

```json
{
  "scripts": {
    "commitlint": "commitlint --edit $GIT_PARAMS || true",
    "prepare": "husky",
    "release": "changeset publish",
    "version:gen": "changeset"
  }
}
```

---

## Workflow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Developer Local Workflow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Make code changes                                            │
│  2. Stage files: git add .                                       │
│  3. Commit: git commit -m "feat: add new feature"               │
│     │                                                             │
│     ├─► Husky pre-commit hook runs:                             │
│     │   • lint-staged (format/lint staged files)                │
│     │   • quality-check --staged --fix                          │
│     │                                                             │
│     └─► Husky commit-msg hook runs:                             │
│         • commitlint validates conventional commit format        │
│                                                                   │
│  4. Create changeset: pnpm version:gen                          │
│     • Select package(s) to version                               │
│     • Choose version bump (major/minor/patch)                    │
│     • Write summary (appears in CHANGELOG)                       │
│                                                                   │
│  5. Commit changeset: git add . && git commit -m "..."          │
│  6. Push to origin: git push origin feature-branch              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Pull Request Phase                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  • PR created → GitHub Actions run:                             │
│    ✓ commitlint.yml validates all commit messages               │
│    ✓ (Other CI checks: build, test, lint)                      │
│                                                                   │
│  • PR approved and merged to main                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Automated Release (GitHub Actions)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Trigger: Push to main with changesets                          │
│                                                                   │
│  Steps (release.yml):                                            │
│  1. Checkout code                                                │
│  2. Setup Node.js 22.20 + pnpm 9                                │
│  3. Install dependencies (frozen-lockfile)                       │
│  4. Run quality checks (pnpm quality-check:ci)                  │
│  5. Build project (pnpm build)                                   │
│  6. Changesets Action:                                           │
│     ├─► If changesets exist:                                     │
│     │   • Create/update "Version Packages" PR                    │
│     │   • Update package.json versions                           │
│     │   • Generate CHANGELOG.md with GitHub links                │
│     │   • Consume changesets (delete .changeset/*.md files)      │
│     │                                                             │
│     └─► If "Version Packages" PR is merged:                      │
│         • Publish to NPM (pnpm release)                          │
│         • Create Git tags                                         │
│         • Generate GitHub release notes                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Developer Workflow

### Step 1: Make Changes

Work on your feature/fix in a separate branch:

```bash
git checkout -b feat/add-export-format
# ... make code changes ...
```

### Step 2: Commit Changes

When you commit, **Husky hooks automatically run**:

```bash
git add .
git commit -m "feat(render): add JSON export format"
```

**What happens:**

1. **Pre-commit hook** runs:
   - `lint-staged`: Formats and lints staged files
   - `quality-check --staged --fix`: Applies safe fixes to staged files
2. **Commit-msg hook** runs:
   - `commitlint`: Validates commit message format

**If commit message is invalid:**

```bash
git commit -m "add json export"
# ⧗   input: add json export
# ✖   type must be one of [build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test] [type-enum]
# ✖   found 1 problems, 0 warnings
# husky - commit-msg script failed (code 1)
```

**Fix it:**

```bash
git commit -m "feat(render): add JSON export format"
# ✔ Commit message valid!
```

### Step 3: Create Changeset

After committing your changes, create a changeset to document the release:

```bash
pnpm version:gen
# or: pnpm changeset
```

**Interactive prompts:**

```
🦋  Which packages would you like to include?
◉ imessage-timeline

🦋  Which type of change is this for imessage-timeline?
❯ patch (0.0.0 → 0.0.1)
  minor (0.0.0 → 0.1.0)
  major (0.0.0 → 1.0.0)

🦋  Please enter a summary for this change (this will be in the changelog):
Add JSON export format for timeline rendering

✔  Changeset added! 🎉
```

**This creates:** `.changeset/random-words-here.md`

```markdown
---
'imessage-timeline': minor
---

Add JSON export format for timeline rendering
```

### Step 4: Commit Changeset

```bash
git add .changeset/
git commit -m "chore: add changeset for JSON export"
git push origin feat/add-export-format
```

### Step 5: Create Pull Request

Open a PR on GitHub. The following checks will run:

- ✅ Commitlint validates all commit messages
- ✅ Tests pass
- ✅ Lint/format checks pass
- ✅ Build succeeds

### Step 6: Merge to Main

Once approved and merged, the **Release workflow** automatically:

1. Detects the changeset
2. Creates/updates a "Version Packages" PR with:
   - Updated `package.json` version
   - Generated `CHANGELOG.md` entries
3. When you merge the "Version Packages" PR:
   - Publishes to NPM
   - Creates Git tags
   - Generates GitHub release notes

---

## Conventional Commits

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Valid Types

| Type       | Description                         | Version Bump |
| ---------- | ----------------------------------- | ------------ |
| `feat`     | New feature                         | minor        |
| `fix`      | Bug fix                             | patch        |
| `docs`     | Documentation changes               | -            |
| `style`    | Code style (formatting, whitespace) | -            |
| `refactor` | Code refactoring (no feature/fix)   | -            |
| `perf`     | Performance improvement             | patch        |
| `test`     | Test changes                        | -            |
| `build`    | Build system changes                | -            |
| `ci`       | CI/CD changes                       | -            |
| `chore`    | Maintenance tasks                   | -            |
| `revert`   | Revert previous commit              | -            |

### Breaking Changes

To indicate a breaking change:

```bash
# Option 1: Add ! after type
git commit -m "feat!: change API signature"

# Option 2: Use BREAKING CHANGE footer
git commit -m "feat: change API signature

BREAKING CHANGE: loadConfig now requires options parameter"
```

**Result:** Major version bump (e.g., `1.0.0` → `2.0.0`)

### Scope Examples

Scopes help organize changes by area:

```bash
git commit -m "feat(cli): add --output-format option"
git commit -m "fix(render): handle empty message arrays"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(ingest): simplify CSV parsing logic"
```

### Good Commit Messages

✅ **Good:**

```bash
feat(render): add JSON export format
fix(ingest): handle malformed CSV rows
docs: update API usage examples
perf(normalize): optimize date conversion
refactor(config): simplify schema validation
```

❌ **Bad:**

```bash
add feature        # Missing type
fix: bug           # Not descriptive
feat add export    # Missing colon
WIP commit         # Not conventional format
Fixed stuff        # Capitalized, not descriptive
```

---

## Changesets Usage

### Creating Changesets

**Scenario 1: Single Feature**

```bash
pnpm version:gen

# Select: imessage-timeline → minor
# Summary: "Add JSON export format for timeline rendering"
```

**Scenario 2: Bug Fix**

```bash
pnpm version:gen

# Select: imessage-timeline → patch
# Summary: "Fix CSV parsing for empty quoted fields"
```

**Scenario 3: Breaking Change**

```bash
pnpm version:gen

# Select: imessage-timeline → major
# Summary: "Remove deprecated loadConfig synchronous API"
```

### Changeset Files

Changesets are stored in `.changeset/` directory:

```markdown
---
'imessage-timeline': minor
---

Add JSON export format for timeline rendering. This allows users to export
processed timelines as structured JSON for integration with external tools.
```

**Multiple changesets are combined** when versioning.

### Manual Changeset Creation

You can manually create changeset files:

```bash
# Create .changeset/add-json-export.md
---
"imessage-timeline": minor
---

Add JSON export format for timeline rendering
```

### Checking Changeset Status

```bash
pnpm changeset status

# Output:
# All changesets:
#
# minor:
#   imessage-timeline: add JSON export format
```

### Pre-release Workflow (Advanced)

For beta/alpha releases:

```bash
# Enter pre-release mode
pnpm changeset pre enter beta

# Create changesets as normal
pnpm version:gen
# Versions will be: 1.0.0-beta.0, 1.0.0-beta.1, etc.

# Exit pre-release mode
pnpm changeset pre exit
```

---

## Git Hooks

### Commit-msg Hook

**Location:** `.husky/commit-msg`

```bash
pnpm commitlint -- --edit $1
```

**Purpose:** Validate commit message format before commit is created.

**Validation rules:**

- Type must be valid (feat, fix, docs, etc.)
- Message must follow `<type>(<scope>): <subject>` format
- Subject must be lowercase (configurable)
- Subject must not end with period

**Example failure:**

```bash
git commit -m "Add feature"
# ✖   subject may not be empty [subject-empty]
# ✖   type may not be empty [type-empty]
```

### Pre-commit Hook

**Location:** `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
pnpm quality-check --staged --fix
```

**Purpose:** Ensure code quality before commit.

**Actions:**

1. **lint-staged**: Format and lint only staged files
2. **quality-check --staged --fix**: Apply safe fixes to staged code

**Configured via:** `package.json` (lint-staged config)

### Skipping Hooks (Emergency Only)

**Skip all hooks:**

```bash
git commit -m "..." --no-verify
# or
git commit -m "..." -n
```

**Skip hooks temporarily:**

```bash
export HUSKY=0
git commit -m "..."
unset HUSKY
```

⚠️ **Warning:** Only skip hooks when absolutely necessary (e.g., reverting
broken commits). Your PR will still be validated by CI.

### Disabling Hooks in CI

Hooks are automatically disabled in CI:

```yaml
# .github/workflows/*.yml
env:
  HUSKY: 0 # Prevents hooks from running in CI
```

**Why?** CI runs its own validation workflows. Hooks are for local development.

---

## CI/CD Pipeline

### Release Workflow

**File:** `.github/workflows/release.yml`

**Triggers:**

- Push to `main` branch
- Manual workflow dispatch

**Permissions:**

- `contents: write` - Create Git tags
- `id-token: write` - NPM provenance
- `pull-requests: write` - Create "Version Packages" PR

**Steps:**

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22.20
      registry-url: 'https://registry.npmjs.org'
  - uses: pnpm/action-setup@v4
    with:
      version: 9
  - run: pnpm install --frozen-lockfile
  - name: Code quality (safe fixes)
    run: pnpm quality-check:ci
  - run: pnpm build
  - name: Changeset Version / Publish
    uses: changesets/action@v1
    with:
      publish: pnpm release
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**What happens:**

1. **No changesets present:**
   - Workflow completes without action
2. **Changesets present (first time):**
   - Creates "Version Packages" PR
   - PR contains:
     - Updated `package.json` version
     - Generated `CHANGELOG.md` entries
     - Consumed changesets (deleted)

3. **"Version Packages" PR merged:**
   - Publishes package to NPM
   - Creates Git tag (e.g., `v0.1.0`)
   - Generates GitHub release notes

### Commitlint Workflow

**File:** `.github/workflows/commitlint.yml`

**Triggers:**

- Pull request events (opened, synchronize, edited, reopened)
- Push to `main` branch

**Purpose:** Validate all commit messages in PR follow conventional commits.

**Example:**

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Use Node 22.20
    uses: actions/setup-node@v4
    with:
      node-version: 22.20
  - name: Install dependencies
    run: pnpm install --frozen-lockfile
  - name: Lint commit messages
    uses: wagoid/commitlint-github-action@v6
      with:
         configFile: commitlint.config.mjs
```

**If commits are invalid:** PR check fails with detailed error message.

---

## Release Process

### Complete Release Walkthrough

#### Phase 1: Development

1. Create feature branch:

   ```bash
   git checkout -b feat/new-feature
   ```

2. Make changes and commit:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   # Hooks run automatically ✓
   ```

3. Create changeset:

   ```bash
   pnpm version:gen
   # Select package, version bump, write summary
   ```

4. Commit changeset:

   ```bash
   git add .changeset/
   git commit -m "chore: add changeset for new feature"
   ```

5. Push and create PR:
   ```bash
   git push origin feat/new-feature
   # Open PR on GitHub
   ```

#### Phase 2: Pull Request

6. **Automated checks run:**
   - ✅ Commitlint validates commit messages
   - ✅ Tests pass
   - ✅ Build succeeds
   - ✅ Lint/format checks pass

7. **Code review and approval**

8. **Merge PR to main**

#### Phase 3: Automated Release

9. **GitHub Actions triggers** (push to main)

10. **Changesets action detects changesets:**
    - Creates "Version Packages" PR
    - PR title: `chore: version packages`
    - Updates:
      - `package.json`: `"version": "0.1.0"`
      - `CHANGELOG.md`: Generated entries with GitHub links
      - Deletes: `.changeset/*.md` files

11. **Review "Version Packages" PR:**
    - Verify version bump is correct
    - Review changelog entries
    - Check no unexpected changes

12. **Merge "Version Packages" PR**

13. **Publish happens automatically:**
    - ✅ Package published to NPM
    - ✅ Git tag created (`v0.1.0`)
    - ✅ GitHub release created
    - ✅ NPM provenance attestation

#### Phase 4: Verification

14. **Verify release:**

    ```bash
    npm view imessage-timeline version
    # Should show: 0.1.0

    npm install imessage-timeline@latest
    # Should install new version
    ```

15. **Verify GitHub release:**
    - Visit: https://github.com/nathanvale/imessage-timeline/releases
    - Check release notes and tag

---

## Troubleshooting

### Problem: Commit rejected by commitlint

**Error:**

```bash
⧗   input: add new feature
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings
```

**Solution:** Use conventional commit format:

```bash
git commit -m "feat: add new feature"
```

---

### Problem: Pre-commit hook fails

**Error:**

```bash
✖ eslint found errors
✖ quality-check found issues
husky - pre-commit hook failed (code 1)
```

**Solutions:**

1. **Auto-fix issues:**

   ```bash
   pnpm lint:fix
   pnpm format
   git add .
   git commit -m "..."
   ```

2. **Check specific errors:**

   ```bash
   pnpm lint
   pnpm quality-check --staged
   ```

3. **Emergency skip (not recommended):**
   ```bash
   git commit -m "..." --no-verify
   ```

---

### Problem: Changeset not detected by CI

**Symptoms:**

- PR merged but no "Version Packages" PR created

**Causes:**

1. No changeset files in `.changeset/` (except `config.json` and `README.md`)
2. Changeset files were deleted before merge

**Solution:**

```bash
# Verify changesets exist
ls .changeset/

# Should see files like:
# - config.json
# - README.md
# - some-random-words.md  ← Your changeset

# If missing, create changeset on main:
git checkout main
git pull origin main
pnpm version:gen
git add .changeset/
git commit -m "chore: add missing changeset"
git push origin main
```

---

### Problem: "Version Packages" PR conflicts

**Symptoms:**

- "Version Packages" PR shows merge conflicts

**Cause:** Multiple PRs merged with changesets before versioning

**Solution:**

1. Checkout "Version Packages" branch locally
2. Resolve conflicts (usually in `CHANGELOG.md` and `package.json`)
3. Push resolution
4. Merge PR

**Or:** Close PR and let GitHub Actions create a fresh one:

```bash
# Close the PR on GitHub
# Push another change to main to trigger new PR creation
```

---

### Problem: NPM publish fails

**Error:**

```
npm ERR! code E403
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/imessage-timeline
```

**Causes:**

1. Invalid or expired `NPM_TOKEN`
2. Package name already taken
3. Insufficient NPM permissions

**Solutions:**

1. **Verify NPM token:**
   - Visit:
     https://github.com/nathanvale/imessage-timeline/settings/secrets/actions
   - Ensure `NPM_TOKEN` is set and valid
   - Generate new token: https://www.npmjs.com/settings/~/tokens

2. **Check package name availability:**

   ```bash
   npm view imessage-timeline
   # Should show your package, not someone else's
   ```

3. **Verify NPM account permissions:**
   - Ensure account has publish rights to package
   - Check 2FA settings if enabled

---

### Problem: Hooks not running

**Symptoms:**

- Commits succeed without validation
- No lint-staged or quality-check runs

**Solutions:**

1. **Verify Husky installation:**

   ```bash
   ls -la .husky/
   # Should see: _, commit-msg, pre-commit

   cat .husky/commit-msg
   # Should contain: pnpm commitlint -- --edit $1
   ```

2. **Reinstall Husky:**

   ```bash
   rm -rf .husky
   pnpm install
   pnpm prepare
   ```

3. **Check Git hooks path:**

   ```bash
   git config core.hooksPath
   # Should output: .husky/_
   ```

4. **Ensure hooks are executable:**
   ```bash
   chmod +x .husky/commit-msg
   chmod +x .husky/pre-commit
   ```

---

### Problem: CI commits fail commitlint

**Error (in GitHub Actions):**

```
✖   subject must not be sentence-case, start-case, pascal-case, upper-case
```

**Cause:** Bot commits (e.g., "Update CHANGELOG.md") may not follow format

**Solution:** Configure commitlint to ignore bot commits:

```javascript
// commitlint.config.mjs
export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message) => message.includes('[skip ci]'),
    (message) => message.startsWith('chore(release):'),
  ],
}
```

---

### Problem: Wrong version bump

**Scenario:** Feature was merged but version bumped as patch instead of minor

**Cause:** Changeset type was incorrect

**Solution (before "Version Packages" merge):**

1. Edit the "Version Packages" PR
2. Close it
3. Create new changeset with correct type:
   ```bash
   git checkout main
   pnpm version:gen
   # Select: minor (correct bump)
   git add .changeset/
   git commit -m "chore: fix version bump type"
   git push origin main
   ```

---

## Best Practices

### Commit Hygiene

✅ **DO:**

- Use conventional commit format for ALL commits
- Write descriptive commit subjects (50 chars max)
- Use scopes to organize changes by area
- Create one changeset per feature/fix
- Test locally before pushing

❌ **DON'T:**

- Skip hooks without good reason
- Merge PRs with invalid commit messages
- Create changesets for non-user-facing changes (internal refactors)
- Use `WIP`, `fix`, or `update` as commit messages

---

### Changeset Guidelines

**When to create a changeset:**

- ✅ New features (`feat`)
- ✅ Bug fixes (`fix`)
- ✅ Breaking changes (`feat!` or `BREAKING CHANGE`)
- ✅ Performance improvements (`perf`)

**When NOT to create a changeset:**

- ❌ Documentation updates (`docs`)
- ❌ Code style changes (`style`)
- ❌ Internal refactoring (`refactor`)
- ❌ Test updates (`test`)
- ❌ Build/CI changes (`build`, `ci`, `chore`)

**Changeset summaries should:**

- Describe the change from user perspective
- Be concise but complete (1-3 sentences)
- Use present tense ("Add feature" not "Added feature")
- Include context if needed

**Example:**

```markdown
---
'imessage-timeline': minor
---

Add JSON export format for timeline rendering. This allows users to export
processed timelines as structured JSON for integration with external tools like
Elasticsearch or custom visualization platforms.
```

---

### Version Bump Guidelines

**Patch (0.0.x):**

- Bug fixes that don't change API
- Performance improvements
- Internal refactoring (if released)

**Minor (0.x.0):**

- New features
- New public API functions
- Backward-compatible changes

**Major (x.0.0):**

- Breaking API changes
- Removed features
- Changed function signatures

**Pre-1.0 exception:** While `version < 1.0.0`, treat minor as major and patch
as minor (semver convention).

---

### Release Cadence

**Recommended:**

- Merge PRs to main frequently (daily/weekly)
- Let "Version Packages" PRs accumulate multiple changes
- Merge "Version Packages" PR weekly or when ready
- Use pre-release versions for beta testing

**Example weekly cycle:**

```
Monday-Friday: Merge feature PRs (with changesets)
↓
"Version Packages" PR auto-updates daily
↓
Friday: Review and merge "Version Packages" PR
↓
Release published automatically
```

---

### GitHub Release Notes

Changesets automatically generates release notes from changeset summaries:

**Example CHANGELOG.md:**

```markdown
## 0.2.0

### Minor Changes

- a1b2c3d: Add JSON export format for timeline rendering. This allows users to
  export processed timelines as structured JSON for integration with external
  tools.

### Patch Changes

- e4f5g6h: Fix CSV parsing for empty quoted fields
```

**Customize release notes:** Edit the "Version Packages" PR description before
merging.

---

### Security: NPM Provenance

This project uses **NPM provenance** for supply chain security:

```yaml
publishConfig: { 'access': 'public', 'provenance': true }
```

**Benefits:**

- Cryptographically links published package to source code
- Verifies package was built by GitHub Actions
- Visible on NPM package page

**Learn more:** https://docs.npmjs.com/generating-provenance-statements

---

### Multi-Package Monorepos (Future)

If you add more packages (e.g., `imessage-timeline-ui`):

**Update `.changeset/config.json`:**

```json
{
  "fixed": [["imessage-timeline", "imessage-timeline-ui"]],
  "linked": []
}
```

**Fixed packages:** Always versioned together (same version number)

**Linked packages:** Version bumped together, but can have different numbers

---

### Emergency Hotfix Workflow

**Scenario:** Critical bug in production, need immediate fix

1. **Create hotfix branch from main:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-bug
   ```

2. **Make fix and commit:**

   ```bash
   git commit -m "fix: resolve critical bug causing data loss"
   ```

3. **Create changeset:**

   ```bash
   pnpm version:gen
   # Select: patch
   # Summary: "Fix critical bug causing data loss"
   ```

4. **Push and create PR:**

   ```bash
   git push origin hotfix/critical-bug
   ```

5. **Fast-track review and merge**

6. **Immediately merge "Version Packages" PR** (don't wait for accumulation)

---

## Useful Commands

### Changeset Commands

```bash
# Create changeset interactively
pnpm version:gen
pnpm changeset

# Check changeset status
pnpm changeset status

# Version packages (manual - usually done by CI)
pnpm changeset version

# Publish packages (manual - usually done by CI)
pnpm release
pnpm changeset publish

# Enter pre-release mode
pnpm changeset pre enter beta

# Exit pre-release mode
pnpm changeset pre exit
```

### Commitlint Commands

```bash
# Lint commit message from file
pnpm commitlint --edit .git/COMMIT_EDITMSG

# Lint last commit
pnpm commitlint --from HEAD~1

# Lint range of commits
pnpm commitlint --from origin/main --to HEAD

# Test commit message
echo "feat: add feature" | pnpm commitlint
```

### Husky Commands

```bash
# Install hooks
pnpm prepare

# Disable hooks temporarily
export HUSKY=0

# Re-enable hooks
unset HUSKY

# Test pre-commit hook
git commit -m "test" --allow-empty

# Test commit-msg hook (add exit 1 to .husky/commit-msg first)
git commit -m "test: hook test"
```

### Git Commands

```bash
# Skip hooks (emergency only)
git commit -m "..." --no-verify
git commit -m "..." -n

# Amend last commit message
git commit --amend -m "feat: corrected message"

# View commit history with conventional format
git log --oneline --format="%s"
```

---

## Additional Resources

### Official Documentation

- **Changesets:** https://github.com/changesets/changesets
- **Conventional Commits:** https://www.conventionalcommits.org/
- **Commitlint:** https://commitlint.js.org/
- **Husky:** https://typicode.github.io/husky/

### Related Docs in This Project

- [Dual-Mode Distribution](./dual-mode-distribution-best-practices.md)
- [README.md](../README.md) - Library usage examples
- [CHANGELOG.md](../CHANGELOG.md) - Generated release history

---

## Summary

This project has a **complete, production-ready automated release workflow**:

✅ **Conventional commits** enforced locally (Husky) and in CI
(commitlint.yml)  
✅ **Changesets** for version management and changelog generation  
✅ **GitHub Actions** for automated releases with NPM provenance  
✅ **Quality gates** with pre-commit hooks and quality-check  
✅ **Comprehensive documentation** (this file)

**Next steps:**

1. Start creating changesets for your features/fixes
2. Watch the "Version Packages" PR get created automatically
3. Merge when ready to publish
4. Enjoy automated releases! 🎉
