# GitHub App Setup Template

Step-by-step guide for setting up GitHub App authentication in any repository to solve the "Bot PR Problem" where Version Packages PRs don't trigger required status checks.

## Prerequisites

- [ ] 1Password CLI installed (`op --version`)
- [ ] GitHub CLI installed (`gh --version`)
- [ ] Access to repo Settings → Secrets and variables
- [ ] Admin access to create GitHub Apps

## Problem Overview

**Issue**: `GITHUB_TOKEN` can't trigger workflows on bot-created PRs (GitHub security feature)

**Symptom**: "Version Packages" PR stuck with "waiting for status" - required checks never run

**Solution**: GitHub App token replaces `GITHUB_TOKEN` - works like a robot account that can trigger workflows

---

## Quick Start Checklist

### Step 1: Create GitHub App (5 min)

- [ ] Go to https://github.com/settings/apps/new
- [ ] Fill in:
  - **Name**: `{repo-name}-changesets-bot` (e.g., `chatline-changesets-bot`)
  - **Homepage URL**: `https://github.com/{owner}/{repo}`
  - **Webhook**: ❌ UNCHECKED
  - **Where can this GitHub App be installed?**: Only on this account
- [ ] Set **Repository permissions**:
  - Contents: Read and write
  - Pull requests: Read and write
  - Workflows: Read and write
- [ ] Click "Create GitHub App"
- [ ] **Note the App ID** (e.g., 2399601)
- [ ] Click "Generate a private key" → Downloads `.pem` file
- [ ] Click "Install App" → Select your repository

**Output**:
- App ID: `_______`
- PEM file: `{repo-name}-changesets-bot.YYYY-MM-DD.private-key.pem`

### Step 2: Store in 1Password (5 min)

**2.1: Create API Credentials Vault** (if needed)

```bash
# Check if "API Credentials" vault exists
op vault list | grep "API Credentials"

# If not, create it:
op vault create "API Credentials" \
  --description "GitHub Apps, API tokens, and service credentials for CI/CD"
```

**2.2: Store GitHub App Credentials**

```bash
# Replace placeholders:
# - {REPO_NAME} with your repo name (e.g., chatline)
# - {APP_ID} with your App ID
# - {CLIENT_ID} with your Client ID
# - {PEM_FILE_PATH} with path to downloaded PEM file

op item create \
  --category="API Credential" \
  --title="{REPO_NAME}-changesets-bot" \
  --vault="API Credentials" \
  --url="https://github.com/settings/apps/{REPO_NAME}-changesets-bot" \
  --tags="github-app,ci-cd,{REPO_NAME}" \
  credential="$(cat {PEM_FILE_PATH})" \
  "App ID[text]"={APP_ID} \
  "Client ID[text]"={CLIENT_ID} \
  "Installed on[text]"="{owner}/{repo}" \
  "Created[text]"="$(date +%Y-%m-%d)" \
  "Expires[text]"="$(date -v+1y +%Y-%m-%d) (1 year)" \
  notesPlain="GitHub App for triggering workflows on bot PRs"
```

**2.3: Verify Storage**

```bash
op item get "{REPO_NAME}-changesets-bot" --vault="API Credentials"
```

### Step 3: Set Up 1Password Service Account (8 min)

**3.1: Create Service Account**

- [ ] Go to: https://my.1password.com/developer-tools
- [ ] Click "Directory" tab → "Service Account"
- [ ] Fill in:
  - **Name**: `GitHub Actions - {repo-name}`
  - **Description**: `Read-only access for CI/CD workflows`
- [ ] Click "Next"
- [ ] Grant vault access:
  - **API Credentials**: ✅ Read Items (check the box, then check "Read Items")
- [ ] Click "Create Account"
- [ ] **Copy the token** (starts with `ops_...`) - **Only shown once!**

**3.2: Add Token to GitHub Secrets**

```bash
# Replace {OWNER}/{REPO} with your repository
cd ~/code/{repo-directory}

gh secret set OP_SERVICE_ACCOUNT_TOKEN \
  --repo {OWNER}/{REPO} \
  --body "ops_..."  # Paste the token you copied
```

**3.3: Save Token Reference in 1Password** (optional, for recovery)

```bash
# Optional: Store a reference (not the actual token, for your records)
op item create \
  --category="Password" \
  --title="{REPO_NAME}_OP_SERVICE_ACCOUNT" \
  --vault="API Credentials" \
  --tags="github-app,service-account" \
  notesPlain="1Password Service Account for GitHub Actions - {repo-name}. Token stored in GitHub Secrets. Created: $(date +%Y-%m-%d). Manage at: https://my.1password.com/developer-tools"
```

### Step 4: Update Workflows (15-30 min)

**Identify workflows using GITHUB_TOKEN**:

```bash
# Find all workflows that use GITHUB_TOKEN
grep -r "GITHUB_TOKEN" .github/workflows/
```

**For each workflow**, add these steps **after dependencies are installed** (after `bun install`, `npm install`, etc.):

```yaml
      - name: Load secrets from 1Password
        uses: 1password/load-secrets-action@581a835fb51b8e7ec56b71cf2ffddd7e68bb25e0 # v2.0.0
        with:
          export-env: true
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          GITHUB_APP_ID: op://API Credentials/{repo-name}-changesets-bot/App ID
          GITHUB_APP_PRIVATE_KEY: op://API Credentials/{repo-name}-changesets-bot/credential

      - name: Generate GitHub App token
        id: app-token
        uses: tibdex/github-app-token@5d52bfa8d8a42cf09fcbdf4464759bda4d5f5f5c # v2.2.0
        with:
          app_id: ${{ env.GITHUB_APP_ID }}
          private_key: ${{ env.GITHUB_APP_PRIVATE_KEY }}
```

**Then replace all `GITHUB_TOKEN` references**:

```yaml
# OLD:
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# NEW:
env:
  GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

**For `actions/github-script`**, add `github-token` parameter:

```yaml
- uses: actions/github-script@v7
  with:
    github-token: ${{ steps.app-token.outputs.token }}  # Add this line
    script: |
      # your script here
```

**Common workflows to update**:
- `changesets-manage-publish.yml`
- `version-packages-auto-merge.yml`
- `release.yml`
- Any workflow that creates/updates PRs or triggers other workflows

### Step 5: Document in Your Repo (10 min)

Add a section to your CI documentation (e.g., `CI.md`, `CONTRIBUTING.md`):

````markdown
## GitHub App Authentication

**App Name**: {repo-name}-changesets-bot
**App ID**: {your-app-id} (public, not secret)
**Purpose**: Enables workflows to trigger on bot-created PRs

**Credentials**:
- Private Key: 1Password → API Credentials → {repo-name}-changesets-bot
- Service Account: 1Password → Developer → Service Accounts → GitHub Actions - {repo-name}
- GitHub Secret: `OP_SERVICE_ACCOUNT_TOKEN`

**Workflows Using App**:
- `changesets-manage-publish.yml` - Version PR creation/publishing
- `version-packages-auto-merge.yml` - Auto-merge enablement
- (list other workflows)

**Credential Rotation**: Set reminder for {date +1 year}
````

### Step 6: Test Setup (5 min)

**Create a test changeset**:

```bash
cd ~/code/{repo-directory}

# Create test changeset
bunx changeset
# Select package, type: patch, summary: "test: verify GitHub App triggers workflows"

# Commit and push
git add .changeset/
git commit -m "test: add changeset to verify GitHub App"
git push
```

**Verify**:
- [ ] Push triggers workflow
- [ ] "Version Packages" PR is created
- [ ] **ALL required checks run automatically** ✅ (this was broken before!)
- [ ] Auto-merge enables
- [ ] PR merges when checks pass

**Check workflow logs for**:
- "Load secrets from 1Password" step succeeds
- "Generate GitHub App token" step succeeds
- Actions show author as `{repo-name}-changesets-bot[bot]`

---

## Troubleshooting

### "authorization prompt dismissed" when using 1Password CLI

**Issue**: `op` command fails with authorization prompt error

**Solution**: Approve the 1Password authorization prompt in your 1Password app, then retry the command

### "Not Found (HTTP 404)" from GitHub API

**Issue**: Branch protection update fails

**Solution**: Use `PATCH` instead of `PUT` method:

```bash
gh api --method PATCH repos/{owner}/{repo}/branches/main/protection/required_status_checks ...
```

### Workflows not triggering on Version Packages PR

**Checklist**:
- [ ] GitHub App has Workflows permission (Read and write)
- [ ] App is installed on the repository
- [ ] `OP_SERVICE_ACCOUNT_TOKEN` is set in GitHub Secrets
- [ ] 1Password Service Account has access to API Credentials vault
- [ ] Workflow files use `steps.app-token.outputs.token`

**Debug**:
```bash
# Check if secret exists
gh secret list --repo {owner}/{repo} | grep OP_SERVICE_ACCOUNT_TOKEN

# Test 1Password access
op item get "{repo-name}-changesets-bot" --vault="API Credentials"

# View workflow run logs for "Load secrets" and "Generate token" steps
```

### "Resource not accessible by integration" error

**Issue**: GitHub App lacks necessary permissions

**Solution**:
1. Go to https://github.com/settings/apps/{repo-name}-changesets-bot
2. Verify permissions: Contents (RW), Pull requests (RW), Workflows (RW)
3. Save changes
4. Reinstall app if needed

---

## 1Password Reference Syntax

When loading secrets in workflows, use this format:

```yaml
GITHUB_APP_ID: op://API Credentials/{repo-name}-changesets-bot/App ID
GITHUB_APP_PRIVATE_KEY: op://API Credentials/{repo-name}-changesets-bot/credential
```

**Syntax**: `op://{VaultName}/{ItemName}/{FieldName}`

- **Vault**: `API Credentials` (the vault you created)
- **Item**: `{repo-name}-changesets-bot` (the item title)
- **Field**:
  - `App ID` - custom field you created
  - `credential` - standard field for API Credential items (contains PEM)

---

## Security Best Practices

**Do**:
- ✅ One GitHub App per repository (easier to revoke, better isolation)
- ✅ Use read-only Service Account access
- ✅ Set expiry reminders for credentials (1 year)
- ✅ Store PEM key only in 1Password (never commit to git)
- ✅ Rotate credentials annually

**Don't**:
- ❌ Share App between multiple repos (isolation matters)
- ❌ Grant write access to Service Account
- ❌ Store PEM key in environment variables
- ❌ Commit `.pem` files or tokens to version control

**Emergency Revocation**:
```bash
# 1. Suspend GitHub App
# Go to: https://github.com/settings/apps/{repo-name}-changesets-bot
# Click: "Suspend" button

# 2. Revoke 1Password Service Account
# Go to: https://my.1password.com/developer-tools
# Find service account → Revoke

# 3. Delete GitHub Secret
gh secret delete OP_SERVICE_ACCOUNT_TOKEN --repo {owner}/{repo}
```

---

## Multi-Repo Setup

**To use this pattern across multiple repositories**:

1. **Create one GitHub App per repo** (recommended for isolation)
   - Name: `{repo-name}-changesets-bot`
   - Installed on: Single repository

2. **Store all apps in same 1Password vault** (`API Credentials`)
   - Item per app: `{repo-name}-changesets-bot`
   - Easy to manage, clear organization

3. **Use one Service Account per organization/team** (optional)
   - Grant access to entire `API Credentials` vault
   - Reuse `OP_SERVICE_ACCOUNT_TOKEN` across repos

4. **Document in each repo's CI docs**
   - Which app is used
   - Where credentials are stored
   - Expiry dates

---

## Example: Complete Workflow Update

**Before** (using GITHUB_TOKEN):

```yaml
name: Release
on: [push]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - uses: changesets/action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**After** (using GitHub App):

```yaml
name: Release
on: [push]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install

      - name: Load secrets from 1Password
        uses: 1password/load-secrets-action@v2.0.0
        with:
          export-env: true
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          GITHUB_APP_ID: op://API Credentials/my-repo-changesets-bot/App ID
          GITHUB_APP_PRIVATE_KEY: op://API Credentials/my-repo-changesets-bot/credential

      - name: Generate GitHub App token
        id: app-token
        uses: tibdex/github-app-token@v2.2.0
        with:
          app_id: ${{ env.GITHUB_APP_ID }}
          private_key: ${{ env.GITHUB_APP_PRIVATE_KEY }}

      - uses: changesets/action@v1
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

---

## Rollback Plan

If GitHub App causes issues:

**Quick Revert**:
```bash
# Revert workflow changes
git revert <commit-sha>

# Or manually change back to:
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Fallback**: Gate-only branch protection still works
- Remove individual checks from branch protection
- Keep only "All checks passed" (gate job)
- Manually merge Version Packages PRs when needed

---

## Success Checklist

Setup is complete when:

- [ ] GitHub App created and installed
- [ ] Credentials stored in 1Password (both PEM and App ID)
- [ ] Service Account created with API Credentials vault access
- [ ] `OP_SERVICE_ACCOUNT_TOKEN` added to GitHub Secrets
- [ ] All workflows updated with 1Password and app token steps
- [ ] All `secrets.GITHUB_TOKEN` replaced with `steps.app-token.outputs.token`
- [ ] CI documentation updated
- [ ] Test changeset merged successfully with checks running
- [ ] No more "waiting for status" on Version Packages PRs

---

## Additional Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [1Password Service Accounts](https://developer.1password.com/docs/service-accounts/)
- [tibdex/github-app-token Action](https://github.com/tibdex/github-app-token)
- [1password/load-secrets-action](https://github.com/1password/load-secrets-action)
- [Changesets Bot PR Issue](https://github.com/changesets/changesets/issues/automate)
