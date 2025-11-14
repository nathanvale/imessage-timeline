# Pre-Mode Workflow (Simple Visual)

## When to Use Which Workflow

```
┌─────────────────────────────────────────┐
│  Do you want to start beta testing?     │
└──────────────┬──────────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │  Run: pre-mode.yml  │
     │  Action: enter      │
     │  Channel: beta      │
     └──────────┬──────────┘
                │
                ▼
      ┌────────────────────┐
      │  Review & Merge PR │
      └──────────┬─────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │  Make changes, merge PRs   │
    │  (changesets auto-created) │
    └──────────┬─────────────────┘
               │
               ▼
     ┌───────────────────────┐
     │  Need to publish?     │
     │  Run:                 │
     │  channel-release.yml  │
     │  Intent: version      │
     └──────────┬────────────┘
                │
                ▼
     ┌────────────────────────┐
     │  channel-release.yml   │
     │  Intent: publish       │
     └──────────┬─────────────┘
                │
                ▼
       ┌─────────────────┐
       │  Beta published! │
       └──────────┬──────┘
                  │
                  ▼
        ┌──────────────────────┐
        │  Ready for stable?   │
        │  Run: pre-mode.yml   │
        │  Action: exit        │
        └──────────┬───────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Review & merge │
          └──────────┬──────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Stable release! │
            └─────────────────┘
```

## Quick Reference

| Task                 | Workflow            | Action/Intent              | Creates PR? |
| -------------------- | ------------------- | -------------------------- | ----------- |
| Start beta testing   | pre-mode.yml        | action=enter, channel=beta | YES         |
| Update beta versions | channel-release.yml | intent=version             | NO          |
| Publish to beta      | channel-release.yml | intent=publish             | NO          |
| Quick test snapshot  | channel-release.yml | intent=snapshot            | NO          |
| End beta testing     | pre-mode.yml        | action=exit                | YES         |

## Decision Tree: Which Workflow?

```
┌────────────────────────────────┐
│  What do you want to do?       │
└────────────┬───────────────────┘
             │
      ┌──────┴────────────────────┐
      │                           │
      ▼                           ▼
┌──────────────┐        ┌──────────────────┐
│ Enter or     │        │ Version, publish,│
│ exit         │        │ or snapshot      │
│ pre-mode?    │        │ packages?        │
└──────┬───────┘        └────────┬─────────┘
       │                         │
       ▼                         ▼
  pre-mode.yml           channel-release.yml
```

## Simple Rules

### Use pre-mode.yml when:

- Starting a beta/rc/next cycle
- Ending a beta/rc/next cycle
- You want a PR for review

### Use channel-release.yml when:

- Already in pre-mode
- Need to bump versions
- Need to publish packages
- Need a quick canary snapshot

## Common Mistakes (Avoid These!)

❌ **WRONG:** Using channel-release.yml to enter pre-mode ✅ **RIGHT:** Using
pre-mode.yml to enter pre-mode

❌ **WRONG:** Trying to version before entering pre-mode ✅ **RIGHT:** Enter
pre-mode first, then version

❌ **WRONG:** Manually editing .changeset/pre.json ✅ **RIGHT:** Let the
workflows handle pre-mode files

## Example: Full Beta Cycle

```
Step 1: START BETA
→ GitHub Actions → pre-mode.yml
→ Inputs:
  - action: enter
  - channel: beta
→ Result: PR created
→ Review PR → Merge PR
→ Status: In beta mode ✅

Step 2: MAKE CHANGES
→ Create feature branch
→ Make changes
→ Open PR to main
→ Merge PR
→ Changesets created automatically

Step 3: BUMP VERSIONS
→ GitHub Actions → channel-release.yml
→ Inputs:
  - channel: beta
  - intent: version
→ Result: Versions bumped (1.0.0-beta.0, 1.0.0-beta.1, etc.)

Step 4: PUBLISH TO NPM
→ GitHub Actions → channel-release.yml
→ Inputs:
  - channel: beta
  - intent: publish
→ Result: Published to npm with @beta tag
→ Users can install: npm install your-package@beta

Step 5: REPEAT 2-4 AS NEEDED
→ More changes → version → publish

Step 6: END BETA
→ GitHub Actions → pre-mode.yml
→ Inputs:
  - action: exit
→ Result: PR created
→ Review PR → Merge PR
→ Status: Out of beta mode ✅

Step 7: STABLE RELEASE
→ Normal release workflow takes over
→ Publishes to npm with @latest tag
```

## Troubleshooting

### "I'm in pre-mode but can't publish"

**Check:** Did you run `version` before `publish`? **Fix:** Run
channel-release.yml with intent=version first

### "I want to exit pre-mode but nothing happened"

**Check:** Did you merge the PR created by pre-mode.yml? **Fix:** Find and merge
the PR with label `release:pre-toggle`

### "My PR doesn't have changesets"

**Don't worry!** The bot creates them automatically from your PR title. Use
conventional commits: `feat:`, `fix:`, `refactor!:`

### "I ran channel-release.yml but I'm not in pre-mode"

**Problem:** You tried to version/publish before entering pre-mode **Fix:** Run
pre-mode.yml with action=enter first

## Visual Workflow States

```
┌─────────────┐
│   STABLE    │  Normal development on main
│   MODE      │  Use standard PR workflow
└──────┬──────┘
       │
       │ pre-mode.yml (enter) → PR → Merge
       ▼
┌─────────────┐
│  PRE-MODE   │  Beta/RC/Next testing
│   ACTIVE    │  Use channel-release.yml for version/publish
└──────┬──────┘
       │
       │ pre-mode.yml (exit) → PR → Merge
       ▼
┌─────────────┐
│   STABLE    │  Back to normal development
│   MODE      │  Ready for stable release
└─────────────┘
```

## How to Check Current Mode

```bash
# Look at .changeset/pre.json
cat .changeset/pre.json

# If file exists and has content → in pre-mode
# If file doesn't exist or is empty → stable mode

# Example pre-mode file:
{
  "mode": "pre",
  "tag": "beta",
  "initialVersions": { ... },
  "changesets": [ ... ]
}
```

## Related Documentation

- Full details: `docs/release-channels.md`
- Canonical flow: `docs/releases/changesets-canonical.md`
- Consolidation plan: `docs/pre-mode-consolidation-plan.md`

---

**Created:** 2025-11-14 **Keep it simple. One workflow for mode changes. One
workflow for operations.**
