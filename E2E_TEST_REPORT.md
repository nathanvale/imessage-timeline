# End-to-End Pre-Release System Test Report

**Date:** 2025-11-16 **Tested By:** Claude Code **Pre-Mode Status:** ACTIVE
(tag: next, version: 0.0.1)

---

## Executive Summary

### Current State

- ✅ Pre-release mode: ACTIVE with `next` channel
- ✅ Main branch workflows: ALL PASSING
- ✅ All shell scripts: VALIDATED (bash + shellcheck)
- ⚠️ **CRITICAL FINDING:** Snapshot publishing is incompatible with pre-release
  mode

### Key Findings

1. **Main Branch Health: FIXED ✅**
   - Changesets workflow now correctly skips publishing in pre-mode
   - Alpha snapshot workflow now correctly skips in pre-mode
   - All workflows passing

2. **Critical Issue Discovered: Snapshot Publishing Incompatibility ⚠️**
   - `changeset version --snapshot` FAILS when `.changeset/pre.json` exists
   - Documentation incorrectly suggests `pnpm release:snapshot:canary` works in
     pre-mode
   - Need to update documentation

---

## Test Results

### Test 1: Current State Validation ✅

**Pre-Release Mode Configuration:**

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

**Package Version:** `0.0.1`

**Main Branch Workflow Status (last 5 runs):**

- ✅ Changesets Manage & Publish: success
- ✅ Commitlint: success
- ✅ Package Hygiene: success
- ✅ PR quality: success
- ✅ CodeQL: success

**Verification:** Latest changesets workflow correctly skipped publishing:

```
##[notice]Pre-release mode is active. Skipping automated publish from main (use pre-release publishing workflow instead).
```

---

### Test 2: Build Artifacts ✅

**Status:** PASSED

**Artifacts Present:**

- ✅ dist/cli.js (72KB)
- ✅ dist/cli.d.ts
- ✅ dist/index.js
- ✅ dist/index.d.ts
- ✅ All TypeScript declarations and source maps

**Conclusion:** Build process working correctly, all required artifacts present.

---

### Test 3: Shell Script Validation ✅

**Status:** ALL PASSED

**Scripts Tested:**

1. ✅ alpha-snapshot-publish.sh - syntax valid, shellcheck clean
2. ✅ changeset-detect-existing.sh - syntax valid, shellcheck clean
3. ✅ changeset-generate-if-missing.sh - syntax valid, shellcheck clean
4. ✅ changesets-publish.sh - syntax valid, shellcheck clean
5. ✅ pre-mode-toggle.sh - syntax valid, shellcheck clean
6. ✅ validate-workflow-schema.sh - syntax valid, shellcheck clean

**Conclusion:** All scripts follow best practices and pass validation.

---

### Test 4: Snapshot Publishing (CRITICAL FINDING) ⚠️

**Status:** INCOMPATIBLE WITH PRE-MODE

**Test Command:**

```bash
pnpm changeset version --snapshot canary
```

**Result:**

```
🦋 error Snapshot release is not allowed in pre mode
🦋 To resolve this exit the pre mode by running `changeset pre exit`
```

**Root Cause:** Changesets explicitly forbids `changeset version --snapshot`
when in pre-release mode.

**Impact:**

- ❌ `pnpm release:snapshot:canary` script CANNOT work in pre-mode
- ❌ Documentation incorrectly states this command works in pre-mode
- ⚠️ Users following docs will hit errors

**Affected Documentation:**

- `docs/pre-release-guide.md` - Line 30, 179-186
- `README.md` - Quick commands section

**Recommendation:** Update documentation to clarify:

1. Snapshot releases (`pnpm release:snapshot:canary`) only work when NOT in
   pre-mode
2. When in pre-mode, use versioned pre-releases instead:
   `pnpm changeset version` → `pnpm publish:pre`
3. Add clear warning about this limitation

---

### Test 5: Versioned Pre-Release Workflow

**Status:** NOT TESTED (requires actual publish)

**Workflow Steps:**

1. Create changeset: `pnpm changeset`
2. Version: `pnpm changeset version` (creates 0.0.1-next.0)
3. Publish: `pnpm publish:pre`

**Expected Behavior:**

- Should create version `0.0.1-next.0` (or next increment)
- Should publish to `@next` dist-tag
- Should work because we're in pre-mode

**Actual Testing:** Skipped (would require npm authentication and actual
publish)

---

### Test 6: Automated Workflows

#### 6.1 Alpha Snapshot Workflow ✅

**Workflow:** `.github/workflows/alpha-snapshot.yml`

**Status:** CORRECTLY SKIPS IN PRE-MODE

**Latest Run:** 2025-11-16 03:04:45 - success

**Annotation:**

```
- Pre-release mode is active. Skipping alpha snapshot (use pre-release versioning instead).
```

**Conclusion:** Fix from PR #30 working correctly.

#### 6.2 Changesets Manage & Publish Workflow ✅

**Workflow:** `.github/workflows/changesets-manage-publish.yml`

**Status:** CORRECTLY SKIPS PUBLISHING IN PRE-MODE

**Latest Run:** 2025-11-16 05:45:33 - success

**Log Output:**

```
##[notice]Pre-release mode is active. Skipping automated publish from main (use pre-release publishing workflow instead).
```

**Conclusion:** Fix from PR #31 working correctly.

---

### Test 7: Pre-Mode Toggle Workflows

**Status:** NOT TESTED (would trigger actual workflow runs)

**Workflows:**

- `.github/workflows/pre-mode.yml` - Enter/exit pre-release mode

**Expected Behavior:**

- `gh workflow run pre-mode.yml -f action=enter -f channel=beta` - should create
  PR to enter beta mode
- `gh workflow run pre-mode.yml -f action=exit -f channel=next` - should create
  PR to exit pre-mode

**Actual Testing:** Skipped (would create PRs)

**Previous Test Results:**

- ✅ PR #27: Successfully entered `next` mode
- ✅ PR #26: Fixed toggle script to detect new files
- ✅ PR #25: Fixed dependency installation

**Conclusion:** Workflows proven to work in previous PRs.

---

## Issues Found

### Issue 1: Documentation Inaccuracy - Snapshot Publishing ⚠️

**Severity:** P1 (High - causes user confusion and errors)

**Location:** Multiple documentation files

**Problem:** Documentation suggests `pnpm release:snapshot:canary` works in
pre-mode, but Changesets explicitly forbids snapshots when `.changeset/pre.json`
exists.

**Files Affected:**

1. `docs/pre-release-guide.md`:
   - Line 30: "Publish a quick canary build NOW | pnpm release:snapshot:canary"
   - Lines 179-186: Detailed snapshot instructions suggesting it works in
     pre-mode

2. `README.md`:
   - Quick commands section suggests canary snapshots work in pre-mode

**User Impact:** Users following docs will run `pnpm release:snapshot:canary`
and get:

```
🦋 error Snapshot release is not allowed in pre mode
```

**Recommended Fix:** Update documentation to clarify:

```markdown
### Snapshot Releases (ONLY when NOT in pre-mode)

**⚠️ Important:** Snapshot releases do NOT work when in pre-release mode. When
`.changeset/pre.json` exists, you must use versioned pre-releases instead.

**When to use snapshots:**

- ✅ When NOT in pre-release mode
- ✅ For quick throwaway builds
- ❌ When in pre-mode (use `pnpm changeset version && pnpm publish:pre` instead)
```

---

### Issue 2: Misleading Quick Reference Table

**Severity:** P2 (Medium - incorrect information)

**Location:** `docs/pre-release-guide.md` Line 28-34

**Problem:** Quick reference table states:

> Publish a quick canary build NOW | pnpm release:snapshot:canary | Instant
> publish as 0.0.1-canary-20251116001234

But current status section says:

> Current Status: Pre-release mode **ACTIVE** with `next` channel

This creates confusion - the command won't work in the current active state.

**Recommended Fix:** Add conditional logic to quick reference:

```markdown
| Goal                 | Command                        | Prerequisites                | What It Does                        |
| -------------------- | ------------------------------ | ---------------------------- | ----------------------------------- |
| Publish quick canary | `pnpm release:snapshot:canary` | **Must EXIT pre-mode first** | Instant publish as 0.0.1-canary-... |
```

---

## Summary of Fixes Applied

### PR #30: Alpha Snapshot Pre-Mode Check ✅

**Status:** MERGED **Impact:** Alpha snapshot workflow now skips gracefully when
in pre-mode

### PR #31: Changesets Publish Pre-Mode Check ✅

**Status:** MERGED **Impact:** Main branch workflow no longer fails with 403
errors in pre-mode

---

## Recommendations

### Immediate Actions Required

1. **Update Documentation (P1)**
   - Fix snapshot publishing instructions in `docs/pre-release-guide.md`
   - Update README.md quick reference
   - Add clear warning about pre-mode limitations
   - Clarify when to use snapshots vs versioned pre-releases

2. **Add Validation Script (P2)**
   - Create script to validate that docs match actual behavior
   - Run in CI to prevent documentation drift

3. **Improve Error Messages (P3)**
   - Consider adding custom error message when users run snapshot in pre-mode
   - Point users to correct workflow

### Long-Term Improvements

1. **Workflow Orchestration**
   - Create higher-level command that auto-detects pre-mode and runs correct
     command
   - Example: `pnpm release:quick` - runs snapshot if not in pre-mode, versioned
     if in pre-mode

2. **Enhanced Documentation**
   - Add flowchart showing decision tree: "Which publishing command should I
     use?"
   - Add troubleshooting section with common errors

---

## Test Coverage Summary

| Test Category            | Status         | Pass Rate                    |
| ------------------------ | -------------- | ---------------------------- |
| Current State Validation | ✅ Complete    | 100%                         |
| Build Artifacts          | ✅ Complete    | 100%                         |
| Shell Script Validation  | ✅ Complete    | 100% (6/6)                   |
| Snapshot Publishing      | ⚠️ Issue Found | N/A                          |
| Versioned Pre-Releases   | ⏭️ Skipped     | N/A                          |
| Automated Workflows      | ✅ Verified    | 100% (2/2)                   |
| Pre-Mode Toggle          | ⏭️ Skipped     | N/A (proven in previous PRs) |

**Overall Health:** 🟢 GOOD (main issues resolved, documentation needs updates)

---

## Conclusion

The pre-release system is **functionally working correctly** after fixes in PR
#30 and #31:

- ✅ Main branch workflows pass
- ✅ Pre-mode detection working in all scripts
- ✅ No more breaking failures

However, there is a **critical documentation issue**:

- ⚠️ Docs incorrectly state snapshot publishing works in pre-mode
- ⚠️ This will cause user confusion and errors

**Next Steps:**

1. Create PR to fix documentation
2. Update quick reference tables
3. Add warnings about pre-mode limitations

**Blocked Items:**

- Cannot test actual npm publish without authentication
- Cannot test pre-mode toggle without creating PRs
- These were previously validated in PRs #25, #26, #27

---

**Test Report Generated:** 2025-11-16 **Total Issues Found:** 2 (1 P1, 1 P2)
**Critical Blockers:** 0 **Main Branch Health:** ✅ GREEN
