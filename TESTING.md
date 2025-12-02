# Release Workflow Testing Guide (ADHD-friendly)

> **Quick nav**: [Auto-Publish](#test-1-auto-publish-workflow) | [Channel Release](#test-2-channel-release-workflow) | [Stable Release](#test-3-stable-release-workflow) | [Pre-mode Toggle](#test-4-pre-mode-toggle) | [Verification](#verification-checklist)

Visual structure. Step-by-step. No surprises.

---

## Pre-Test Setup (2 minutes)

**Before testing any workflow:**

1. **Verify OIDC is configured**:
   - Go to: [npmjs.com/package/@nathanvale/chatline/access](https://www.npmjs.com/package/@nathanvale/chatline/access)
   - Settings → Trusted Publisher section
   - Should see: `nathanvale/chatline` with `channel-release.yml` workflow

2. **Check Node 24 is available in CI**:
   ```bash
   # Workflows use Node 24 for npm 11.6+ (OIDC support)
   # This is already configured in workflows
   ```

3. **Verify GitHub Actions permissions**:
   - Repo Settings → Actions → General
   - Workflow permissions: "Read and write permissions" ✅
   - "Allow GitHub Actions to create and approve pull requests" ✅

4. **Local environment check**:
   ```bash
   # Auth
   gh auth status
   npm whoami

   # Clean state
   git status --short --branch

   # Dependencies
   bun install --frozen-lockfile
   ```

**Safety notes**:
- All tests publish to npm (use canary tag for safety)
- Each test is independent (run one at a time)
- Keep `NPM_TOKEN` secret as fallback (OIDC primary)

---

## Test 1: Auto-Publish Workflow (changesets-manage-publish.yml)

**What you're testing**: Automatic "Version Packages" PR creation + auto-publish on merge

**Duration**: ~10 minutes

**Safety**: Publishes to npm `latest` tag (use this for real releases only)

### Step 1: Create Test Changeset

```bash
# Create feature branch
git checkout -b test/auto-publish-workflow
git push -u origin test/auto-publish-workflow

# Add a changeset
bunx changeset

# Example changeset:
# - Package: @nathanvale/chatline
# - Type: patch
# - Summary: "test: verify auto-publish workflow"

# Commit and push
git add .changeset/
git commit -m "test: add changeset for auto-publish workflow"
git push
```

**✅ Verify**: Changeset file created in `.changeset/` directory

---

### Step 2: Create PR and Merge to Main

```bash
# Create PR via GitHub CLI
gh pr create \
  --title "test: auto-publish workflow" \
  --body "Testing changesets auto-publish workflow. This PR will trigger the bot to create a 'Version Packages' PR."

# Wait for PR checks to pass
gh pr checks

# Merge to main
gh pr merge --squash --auto
```

**✅ Verify**:
- PR checks pass (quality-check, tests, etc.)
- PR merges successfully
- You're back on `main` branch

---

### Step 3: Wait for "Version Packages" PR

**What happens**: `changesets-manage-publish.yml` workflow runs on main push

**Timeline**: ~2-3 minutes

**Where to watch**:
- Actions → "Changesets Manage & Publish"
- Pull Requests → Look for "Version Packages" PR from `github-actions[bot]`

**Expected PR contents**:
- Title: "Version Packages"
- Changes:
  - `package.json` version bumped (e.g., `0.0.1` → `0.0.2`)
  - `.changeset/` files removed
  - `CHANGELOG.md` updated with new entry

**✅ Verify**:
- "Version Packages" PR created
- Version bump is correct (patch/minor/major)
- CHANGELOG.md has your changeset summary
- No workflow errors in Actions tab

---

### Step 4: Review and Merge "Version Packages" PR

```bash
# Check out the Version Packages PR locally (optional)
gh pr checkout <PR-number>

# Review changes
git log -1 --stat

# Switch back to main and merge
gh pr merge <PR-number> --squash --auto
```

**What happens on merge**: Workflow detects version commit and publishes to npm

**✅ Verify**:
- Workflow runs: Actions → "Changesets Manage & Publish"
- Workflow step "Changesets - open PR or publish" shows publish logs
- Check workflow logs for:
  ```
  🦋  info npm token bypassed
  🦋  Publishing packages to npm
  🦋  success packages published successfully
  ```

---

### Step 5: Verify npm Publish

```bash
# Check npm registry
npm view @nathanvale/chatline

# Expected output shows new version:
# @nathanvale/chatline@0.0.2 | MIT | deps: 8 | versions: 3

# Check dist-tags
npm view @nathanvale/chatline dist-tags

# Expected:
# latest: 0.0.2
```

**✅ Verify**:
- New version appears on npm
- `latest` tag points to new version
- Package page shows provenance badge (shield icon)

---

### Step 6: Verify Provenance

1. Go to: `https://www.npmjs.com/package/@nathanvale/chatline`
2. Click the version number
3. Look for "Provenance" section
4. Click "View more details"

**✅ Verify**:
- Provenance attestation exists
- Source: `github.com/nathanvale/chatline`
- Workflow: `changesets-manage-publish.yml`
- Commit SHA matches your merge commit

---

### Cleanup

```bash
# Delete test branch
git branch -d test/auto-publish-workflow
git push origin --delete test/auto-publish-workflow
```

---

## Test 2: Channel Release Workflow (channel-release.yml)

**What you're testing**: Manual prerelease channel publish (next/beta/rc) + canary snapshots

**Duration**: ~15 minutes

**Safety**: Uses channel tags (not `latest`), safe for testing

### Test 2A: Prerelease Channel (next)

#### Step 1: Enter Pre-Mode

```bash
# Checkout test branch
git checkout -b test/channel-release-next
git push -u origin test/channel-release-next

# Enter pre-mode
bunx changeset pre enter next

# ✅ Verify: .changeset/pre.json created with:
cat .changeset/pre.json
# Expected:
# {
#   "mode": "pre",
#   "tag": "next",
#   "initialVersions": { "@nathanvale/chatline": "0.0.2" },
#   "changesets": []
# }

# Commit and push
git add .changeset/pre.json
git commit -m "chore: enter next pre-mode"
git push
```

**✅ Verify**: `.changeset/pre.json` exists and has `"tag": "next"`

---

#### Step 2: Add Changeset for Prerelease

```bash
# Add changeset
bunx changeset

# Example:
# - Package: @nathanvale/chatline
# - Type: minor
# - Summary: "feat: test next channel prerelease"

# Commit and push
git add .changeset/
git commit -m "feat: add changeset for next channel"
git push
```

**✅ Verify**: Changeset file in `.changeset/` directory

---

#### Step 3: Run Version Workflow

**Via GitHub Actions UI**:
1. Go to: Actions → "Channel Release (manual)"
2. Click "Run workflow"
3. Select branch: `test/channel-release-next`
4. Channel: `next`
5. Intent: `version`
6. Run workflow

**What happens**: Workflow runs `changeset version`, commits bump

**✅ Verify** (in workflow logs):
- Workflow completes successfully
- Check commit history:
  ```bash
  git pull
  git log -1 --oneline
  # Expected: "chore(prerelease): version bump on next channel"
  ```
- Check version bump:
  ```bash
  cat package.json | grep version
  # Expected: "version": "0.1.0-next.0"
  ```
- Check CHANGELOG.md has prerelease entry

---

#### Step 4: Run Publish Workflow

**Via GitHub Actions UI**:
1. Go to: Actions → "Channel Release (manual)"
2. Click "Run workflow"
3. Select branch: `test/channel-release-next`
4. Channel: `next`
5. Intent: `publish`
6. Run workflow

**What happens**: Publishes `0.1.0-next.0` with `--tag next`

**✅ Verify** (in workflow logs):
- Step "Publish prerelease" shows:
  ```
  🦋  Publishing packages to npm
  🦋  success packages published successfully
  ```
- Check npm:
  ```bash
  npm view @nathanvale/chatline dist-tags
  # Expected:
  # latest: 0.0.2
  # next: 0.1.0-next.0
  ```

---

#### Step 5: Test Installing from Channel

```bash
# Create temp directory
mkdir -p /tmp/test-next-install
cd /tmp/test-next-install

# Install from next channel
npm install @nathanvale/chatline@next

# ✅ Verify version
npm list @nathanvale/chatline
# Expected: @nathanvale/chatline@0.1.0-next.0

# Cleanup
cd -
rm -rf /tmp/test-next-install
```

---

#### Step 6: Exit Pre-Mode and Cleanup

```bash
# Exit pre-mode
bunx changeset pre exit

# ✅ Verify: .changeset/pre.json deleted
test -f .changeset/pre.json && echo "Still in pre-mode!" || echo "Pre-mode exited ✅"

# Commit
git add .changeset/pre.json
git commit -m "chore: exit next pre-mode"
git push

# Merge to main (optional)
gh pr create --title "test: next channel release" --body "Testing prerelease workflow"
gh pr merge --squash --auto

# Delete branch
git checkout main
git pull
git branch -d test/channel-release-next
git push origin --delete test/channel-release-next
```

---

### Test 2B: Canary Snapshot

**What you're testing**: Quick snapshot publish without version bump

**Duration**: ~5 minutes

#### Step 1: Ensure Pre-Mode is OFF

```bash
# Check pre-mode status
test -f .changeset/pre.json && echo "⚠️  In pre-mode, exit first!" || echo "✅ Not in pre-mode"

# If in pre-mode, exit:
bunx changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit pre-mode for canary test"
git push
```

---

#### Step 2: Run Snapshot Workflow

**Via GitHub Actions UI**:
1. Go to: Actions → "Channel Release (manual)"
2. Click "Run workflow"
3. Select branch: `main` (or any branch)
4. Channel: `canary`
5. Intent: `snapshot`
6. Run workflow

**What happens**:
- Creates snapshot version (e.g., `0.0.0-canary-20241203123456`)
- Publishes with `--tag canary`
- No git commit (ephemeral)

**✅ Verify** (in workflow logs):
- Step "Canary snapshot publish" shows:
  ```
  🦋  New tag: @nathanvale/chatline@0.0.0-canary-20241203123456
  🦋  Publishing packages to npm
  🦋  success packages published successfully
  ```

---

#### Step 3: Verify Canary Tag on npm

```bash
npm view @nathanvale/chatline dist-tags

# Expected:
# latest: 0.0.2
# next: 0.1.0-next.0
# canary: 0.0.0-canary-20241203123456
```

**✅ Verify**: `canary` tag exists and points to snapshot version

---

#### Step 4: Test Installing Canary

```bash
# Install canary version
mkdir -p /tmp/test-canary
cd /tmp/test-canary
npm install @nathanvale/chatline@canary

# ✅ Verify
npm list @nathanvale/chatline
# Expected: @nathanvale/chatline@0.0.0-canary-YYYYMMDDHHMMSS

# Cleanup
cd -
rm -rf /tmp/test-canary
```

---

## Test 3: Stable Release Workflow (release.yml)

**What you're testing**: Manual stable release with full quality checks

**Duration**: ~8 minutes

**Safety**: Publishes to `latest` tag (use carefully!)

### Step 1: Ensure Clean State

```bash
# Exit pre-mode if active
test -f .changeset/pre.json && bunx changeset pre exit

# Checkout main
git checkout main
git pull

# Verify no pending changesets
bunx changeset status
# Expected: "🦋  No changesets present"
```

**✅ Verify**: Clean state, no changesets, not in pre-mode

---

### Step 2: Add Changeset for Stable Release

```bash
# Add changeset
bunx changeset

# Example:
# - Package: @nathanvale/chatline
# - Type: patch
# - Summary: "fix: test stable release workflow"

# Commit and push
git add .changeset/
git commit -m "fix: add changeset for stable release test"
git push
```

**✅ Verify**: Changeset committed to main

---

### Step 3: Run Release Workflow

**Via GitHub Actions UI**:
1. Go to: Actions → "Release"
2. Click "Run workflow"
3. Select branch: `main`
4. Run workflow

**What happens**:
1. Runs quality checks (`bun run quality-check:ci`)
2. Runs build (`bun run build`)
3. Generates SBOM (Software Bill of Materials)
4. Runs `changeset version` (bumps version, updates CHANGELOG)
5. Publishes to npm with `latest` tag
6. Creates GitHub release

**Duration**: ~5-8 minutes

**✅ Verify** (in workflow logs):
- All quality checks pass
- Build succeeds
- SBOM generated
- Version bump shows in logs
- Publish succeeds:
  ```
  🦋  Publishing packages to npm
  🦋  success packages published successfully
  ```

---

### Step 4: Verify Stable Release

```bash
# Check npm
npm view @nathanvale/chatline

# ✅ Verify:
# - Version bumped (e.g., 0.0.3)
# - `latest` tag points to new version

# Check GitHub releases
gh release list

# ✅ Verify:
# - New release created with version tag (e.g., v0.0.3)
# - Release notes contain changeset summary
```

---

### Step 5: Verify Provenance

1. Go to: `https://www.npmjs.com/package/@nathanvale/chatline`
2. Check provenance badge
3. Verify workflow: `release.yml`

**✅ Verify**: Provenance attestation exists for stable release

---

## Test 4: Pre-Mode Toggle (pre-mode.yml)

**What you're testing**: Workflow to enter/exit prerelease mode

**Duration**: ~3 minutes

### Step 1: Enter Pre-Mode via Workflow

**Via GitHub Actions UI**:
1. Go to: Actions → "Changesets Pre-Mode Toggle"
2. Click "Run workflow"
3. Select branch: `main`
4. Action: `enter`
5. Channel: `beta`
6. Run workflow

**What happens**: Commits `.changeset/pre.json` to branch

**✅ Verify**:
- Workflow completes
- Check commit:
  ```bash
  git pull
  cat .changeset/pre.json
  # Expected: {"mode": "pre", "tag": "beta", ...}
  ```

---

### Step 2: Exit Pre-Mode via Workflow

**Via GitHub Actions UI**:
1. Go to: Actions → "Changesets Pre-Mode Toggle"
2. Click "Run workflow"
3. Select branch: `main`
4. Action: `exit`
5. Channel: (ignored for exit)
6. Run workflow

**✅ Verify**:
- Workflow completes
- `.changeset/pre.json` deleted:
  ```bash
  git pull
  test -f .changeset/pre.json && echo "❌ Still exists" || echo "✅ Deleted"
  ```

---

## Verification Checklist

Use this after running tests to ensure everything works:

### OIDC Trusted Publishing
- [ ] No `NPM_TOKEN` warnings in workflow logs
- [ ] Workflow logs show: "No NPM_TOKEN; relying on OIDC trusted publishing"
- [ ] Publish succeeds without token
- [ ] Provenance badge appears on npm package page

### Changesets Integration
- [ ] `bunx changeset status` shows accurate pending changesets
- [ ] Version bumps follow semver (patch/minor/major)
- [ ] CHANGELOG.md updates correctly
- [ ] Changesets are removed after version bump

### GitHub Actions
- [ ] All workflows complete successfully
- [ ] Quality checks pass (biome, typecheck)
- [ ] Build step succeeds
- [ ] Publish step succeeds
- [ ] Git commits are created (for version workflows)
- [ ] No permission errors

### npm Registry
- [ ] New versions appear on npm
- [ ] Dist-tags are correct (`latest`, `next`, `beta`, `canary`)
- [ ] Provenance attestations exist
- [ ] Package installs successfully (`npm install`)
- [ ] Scoped package is public (not 404)

### Git State
- [ ] No uncommitted changes after workflows
- [ ] Tags are pushed to GitHub
- [ ] Branches are clean
- [ ] Pre-mode state matches expectations

---

## Troubleshooting Tests

### "npm ERR! code ENEEDAUTH"

**Cause**: OIDC not configured OR npm version too old

**Fix**:
1. Verify trusted publisher at npmjs.com
2. Ensure workflow uses Node 24 (npm 11.6+)
3. Add `NPM_TOKEN` as fallback

---

### "Snapshot release is not allowed in pre mode"

**Cause**: Trying canary snapshot while in pre-mode

**Fix**:
```bash
bunx changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit pre-mode"
git push
# Re-run workflow
```

---

### "Not in pre-release mode" (channel-release.yml version/publish)

**Cause**: Trying prerelease version/publish without pre-mode

**Fix**:
```bash
bunx changeset pre enter next
git add .changeset/pre.json
git commit -m "chore: enter pre-mode"
git push
# Re-run workflow
```

---

### Workflow succeeds but package not on npm

**Cause**: Publish step silently failed (check logs)

**Fix**:
1. Check workflow logs for actual error
2. Verify package name isn't taken
3. Verify you have publish permissions
4. Try manual publish locally:
   ```bash
   npm publish --dry-run
   ```

---

### GitHub release not created

**Cause**: `release.yml` doesn't create GitHub releases automatically

**Fix**: Use `gh release create` manually or add to workflow:
```yaml
- name: Create GitHub Release
  run: gh release create v$(node -p "require('./package.json').version") --generate-notes
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Test Results Template

Copy this template to track your test results:

```markdown
## Release Workflow Test Results

**Date**: YYYY-MM-DD
**Tester**: Your Name
**Branch**: test/release-workflows

### Test 1: Auto-Publish Workflow
- [ ] Changeset created
- [ ] PR merged to main
- [ ] "Version Packages" PR created
- [ ] Version Packages PR merged
- [ ] Package published to npm
- [ ] Provenance verified
- **Result**: ✅ Pass / ❌ Fail
- **Notes**:

### Test 2A: Prerelease Channel (next)
- [ ] Entered pre-mode
- [ ] Changeset added
- [ ] Version workflow ran
- [ ] Publish workflow ran
- [ ] Package on npm with `next` tag
- [ ] Installed from `next` tag
- [ ] Exited pre-mode
- **Result**: ✅ Pass / ❌ Fail
- **Notes**:

### Test 2B: Canary Snapshot
- [ ] Pre-mode exited
- [ ] Snapshot workflow ran
- [ ] Canary tag on npm
- [ ] Installed from canary
- **Result**: ✅ Pass / ❌ Fail
- **Notes**:

### Test 3: Stable Release
- [ ] Clean state verified
- [ ] Changeset added
- [ ] Release workflow ran
- [ ] Package published to `latest`
- [ ] Provenance verified
- **Result**: ✅ Pass / ❌ Fail
- **Notes**:

### Test 4: Pre-Mode Toggle
- [ ] Entered via workflow
- [ ] Exited via workflow
- **Result**: ✅ Pass / ❌ Fail
- **Notes**:

### Overall Result
- **OIDC Working**: ✅ Yes / ❌ No
- **All Tests Pass**: ✅ Yes / ❌ No
- **Ready for Production**: ✅ Yes / ❌ No
```

---

## Next Steps After Testing

1. **If all tests pass**:
   - Document any edge cases discovered
   - Update RELEASES.md with lessons learned
   - Consider enabling auto-publish for all stable releases

2. **If tests fail**:
   - Check workflow logs for specific errors
   - Verify OIDC configuration
   - Test with `NPM_TOKEN` fallback
   - Open GitHub issue with logs

3. **Ongoing maintenance**:
   - Test workflows quarterly
   - Update when Changesets or npm changes
   - Monitor npm deprecation notices
   - Keep Node version current (24+)
