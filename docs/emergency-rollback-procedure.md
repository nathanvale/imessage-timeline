# Emergency Rollback Procedure

## When to Use Emergency Rollback

Use this when a published version has **critical issues** that require immediate
action:

- Security vulnerability
- Data loss bug
- Package won't install
- Completely broken functionality

**DON'T use for:**

- Minor bugs (create patch release instead)
- Performance issues (document and fix in next release)
- Documentation errors (update docs)

---

## Quick Start

1. Go to:
   https://github.com/nathanvale/imessage-timeline/actions/workflows/emergency-rollback.yml
2. Click "Run workflow"
3. Fill in:
   - **Version:** The broken version (e.g., `1.2.3`)
   - **Reason:** Short message users will see
   - **Create issue:** Leave checked
4. Click "Run workflow"

---

## What It Does

1. **Validates** version exists on npm
2. **Deprecates** the version with your message
3. **Creates** GitHub issue to track rollback
4. **Documents** rollback in workflow summary

---

## After Rollback

### 1. Users See Warning

When they try to install the bad version:

```
npm WARN deprecated imessage-timeline@1.2.3: This version has critical issues. Please upgrade.
```

### 2. Fix the Issue

- Create PR with fix
- Add changeset (patch bump)
- Get it reviewed and merged

### 3. Publish Fixed Version

- Merge "Version Packages" PR
- New version publishes automatically
- Update rollback issue with fix version

### 4. Communicate

- Comment on rollback issue
- Post in relevant channels
- Update any external documentation

---

## Example Reasons

**Good reasons:**

- "Critical security vulnerability. Please upgrade to 1.2.4+"
- "Data corruption bug. Do not use. Upgrade to 1.2.4"
- "Package is broken and won't install. Fixed in 1.2.4"

**Bad reasons:**

- "Oops, didn't mean to publish this"
- "Has a small bug"
- "Performance could be better"

---

## What npm deprecate Does

- ✅ Marks version as deprecated
- ✅ Shows warning when users install it
- ✅ Version still installable (users can choose to ignore warning)
- Does NOT remove version from npm
- Does NOT prevent installation

---

## If You Need to Unpublish (Nuclear Option)

**Only within 72 hours of publish, and only if:**

- Accidentally published secrets/credentials
- Legal/licensing issue
- Malware/malicious code

**To unpublish:**

```bash
npm unpublish imessage-timeline@1.2.3
```

**WARNING:** This breaks projects that depend on this exact version. Use
deprecate instead whenever possible.

---

## Troubleshooting

### "Version not found on npm"

- Check spelling
- Verify version was actually published
- Check npm registry: `npm view imessage-timeline versions`

### "401 Unauthorized"

- NPM_TOKEN secret is missing or invalid
- Regenerate token following `docs/npm-automation-token-setup.md`

### "403 Forbidden"

- You don't have permission to deprecate
- Must be package maintainer/owner
- Check: `npm owner ls imessage-timeline`

---

## Related

- [NPM Deprecate Docs](https://docs.npmjs.com/cli/v9/commands/npm-deprecate)
- [NPM Unpublish Policy](https://docs.npmjs.com/policies/unpublish)
- `docs/automated-release-workflow.md` - Normal release process
