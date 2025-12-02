# NPM Automation Token Setup Guide

> **TL;DR:** Use granular automation tokens with read/write permissions for
> `chatline` only.

## Why Automation Tokens?

Regular tokens can publish ALL your packages. Automation tokens can be
restricted to specific packages.

**Security:** If token leaks, damage is limited to this package only.

---

## Step-by-Step Setup

### 1. Go to NPM Token Page

Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens

(Replace YOUR_USERNAME with your npm username)

### 2. Click "Generate New Token"

Button is in the top right.

### 3. Select Token Type

Choose: **Automation**

(Not "Publish" - automation tokens have better security)

### 4. Configure Token Permissions

**Package permissions:**

- Select: "Read and write"
- Package: `chatline`

**IP Allowlist:** Leave empty (GitHub Actions IPs rotate)

**Expiration:**

- Recommended: 90 days
- Set a calendar reminder to rotate

### 5. Copy the Token

**IMPORTANT:** You only see this ONCE!

Format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 6. Add to GitHub Secrets

1. Go to:
   `https://github.com/nathanvale/chatline/settings/secrets/actions`
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste the token
5. Click "Add secret"

### 7. Verify It Works

The token is used in these workflows:

- `.github/workflows/changesets-manage-publish.yml`
- `.github/workflows/alpha-snapshot.yml`
- `.github/workflows/channel-release.yml`

Next time you merge a "Version Packages" PR, it will use this token to publish.

---

## Security Best Practices

✅ **DO:**

- Use automation tokens (not classic tokens)
- Set expiration dates
- Rotate tokens every 90 days
- Restrict to specific packages
- Store in GitHub Secrets only

❌ **DON'T:**

- Use classic "Publish" tokens
- Share tokens in chat/email
- Commit tokens to git
- Use tokens without expiration
- Give tokens access to all packages

---

## Troubleshooting

### "403 Forbidden" Error

**Problem:** Token doesn't have permission to publish package

**Solution:**

1. Check token has "Read and write" permission
2. Verify package name is `chatline`
3. Make sure you're an owner/maintainer of the package

### "401 Unauthorized" Error

**Problem:** Token is invalid or expired

**Solution:**

1. Generate a new token following steps above
2. Update GitHub secret `NPM_TOKEN`
3. Re-run the workflow

### Token Expired

**Problem:** Got email "Your npm token is expiring soon"

**Solution:**

1. Generate a new token (same steps)
2. Update GitHub secret `NPM_TOKEN`
3. Old token is automatically revoked

---

## Rotation Schedule

**Recommended:** Rotate tokens every 90 days

1. Set calendar reminder for rotation date
2. Generate new token
3. Update GitHub secret
4. Old token automatically expires
5. Reset calendar reminder for 90 days later

---

## Related Documentation

- [NPM Automation Tokens Docs](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- `docs/automated-release-workflow.md` - How publishing workflows use the token
