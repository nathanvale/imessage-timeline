# Monorepo & Documentation Strategy Recommendations

**Date:** 2025-11-16 **Context:** Research-backed recommendations for Docusaurus
integration and potential monorepo structure

---

## Executive Summary

Based on comprehensive research of industry best practices, this document
provides recommendations for:

1. **Docusaurus Integration** - Add documentation site to current repo
2. **Workspace Strategy** - When to adopt pnpm workspaces
3. **Build Optimization** - When to add TurboRepo
4. **Git Template** - Flexible structure for single/mono repos

### Key Recommendation

**Start simple, scale as needed:**

- ✅ Add Docusaurus to current single-repo structure now
- ⏳ Defer pnpm workspaces until you have 2+ publishable packages
- ⏳ Defer TurboRepo until build performance becomes critical

---

## 1. Docusaurus Integration Strategy

### Recommendation: Add Docusaurus to Current Repo

**Why:**

- Documentation lives with code (version controlled together)
- Atomic commits for code + docs changes
- Simplified maintenance (one repo to manage)
- No additional repo complexity for current single-package project

**How to Structure:**

```
chatline/
├── .changeset/
├── .github/
├── dist/
├── docs/                    # Existing markdown docs (keep as-is)
│   ├── releases/
│   ├── pre-release-guide.md
│   ├── release-channels.md
│   └── ...
├── website/                 # NEW: Docusaurus site
│   ├── docs/               # Docusaurus docs (can link to ../docs/)
│   ├── blog/
│   ├── src/
│   ├── static/
│   ├── docusaurus.config.js
│   └── package.json        # Docusaurus dependencies (sub-package)
├── src/
├── package.json            # Main package
└── README.md
```

**Implementation Steps:**

1. **Initialize Docusaurus** (without workspaces):

   ```bash
   npx create-docusaurus@latest website classic --typescript
   ```

2. **Update `.gitignore`**:

   ```
   # Docusaurus
   website/.docusaurus/
   website/.cache-loader/
   website/build/
   website/node_modules/
   ```

3. **Add npm scripts** to root `package.json`:

   ```json
   {
     "scripts": {
       "docs:build": "cd website && npm run build",
       "docs:dev": "cd website && npm start",
       "docs:serve": "cd website && npm run serve"
     }
   }
   ```

4. **Configure Docusaurus** to use existing docs:

   ```js
   // website/docusaurus.config.js
   module.exports = {
     presets: [
       [
         'classic',
         {
           docs: {
             path: '../docs', // Point to existing docs folder
             routeBasePath: 'docs',
           },
         },
       ],
     ],
   }
   ```

5. **Add GitHub Pages deployment** (`.github/workflows/docs.yml`):
   ```yaml
   name: Deploy Docs
   on:
     push:
       branches: [main]
       paths:
         - 'docs/**'
         - 'website/**'
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
         - run: cd website && npm ci && npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./website/build
   ```

**Benefits:**

- ✅ Professional documentation site with search, versioning, and navigation
- ✅ Keeps existing markdown docs in `docs/` (no migration needed)
- ✅ Minimal complexity (no workspaces required)
- ✅ Easy to deploy to GitHub Pages or Netlify

---

## 2. pnpm Workspaces Strategy

### Current State: Single Package

Your project currently has:

- 1 publishable package (`chatline`)
- Docusaurus would be a dev-only tool (not published)

### Recommendation: Defer Workspaces Until You Need Them

**When to adopt pnpm workspaces:**

✅ **Yes, use workspaces when:**

- You have 2+ publishable packages with shared dependencies
- You want to split CLI tool from core library
- You're building plugins/extensions architecture
- You need to share TypeScript configs/tooling across packages

❌ **No, skip workspaces if:**

- Single package project (current state)
- Docusaurus is only additional "package" (dev tool only)
- No immediate plans for multiple publishable packages

### Future Migration Path (When Ready)

If you later decide to split into packages:

```
chatline/                    # Monorepo root
├── .changeset/
├── .github/
├── pnpm-workspace.yaml              # NEW: Workspace config
├── package.json                     # Root package (scripts only)
├── packages/
│   ├── core/                        # @chatline/core
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/                         # chatline (CLI)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── utils/                       # @chatline/utils
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── docs/                        # Docusaurus site
│       ├── docs/
│       ├── docusaurus.config.js
│       └── package.json
└── README.md
```

**Migration script** (when ready):

```bash
# 1. Create workspace structure
mkdir -p packages/cli apps/docs
mv src packages/cli/
mv website apps/docs/

# 2. Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml <<EOF
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# 3. Update package.json references
# 4. Run: pnpm install
```

---

## 3. TurboRepo Strategy

### Recommendation: Start with pnpm Workspaces, Add TurboRepo Later

**Current verdict:** You don't need TurboRepo yet.

**Why:**

- TurboRepo is "pnpm workspaces + build optimization"
- Adds caching, task orchestration, and remote caching
- Best for large monorepos with slow build times

**When to add TurboRepo:**

✅ **Yes, add TurboRepo when:**

- Your builds take 5+ minutes
- You have 5+ packages with complex dependency graphs
- You want remote caching for CI/CD speedups
- Your team has 10+ developers

❌ **No, defer TurboRepo if:**

- Your builds complete in < 2 minutes
- Single package or 2-3 simple packages
- Team of 5 developers (current state)

### Research-Backed Quote

> "PNPM is fast and space-efficient, **Turborepo is PNPM with build
> optimization**, and Nx is PNPM with build optimization, task orchestration,
> and additional features" —
> [ekino.fr Monorepo Insights](https://www.ekino.fr/publications/monorepo-insights-nx-turborepo-and-pnpm)

**Performance Comparison:**

- pnpm alone: Excellent for dependency management, ~500% faster installs than
  npm
- pnpm + TurboRepo: Add 3-10x faster builds via caching
- Cost: Additional configuration complexity

**Future Setup** (when needed):

```bash
pnpm add -Dw turbo
```

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "cache": false
    }
  }
}
```

---

## 4. Git Template Strategy

### Recommendation: Flexible Single-Repo Template

Create a git template that works for both single and mono repos by using
**convention-based structure** and **optional workspace config**.

### Template Structure

```
repo-template/
├── .changeset/
│   └── config.json          # Works for single or multi-package
├── .github/
│   ├── workflows/
│   │   ├── pr-quality.yml   # Lint, test, typecheck
│   │   ├── changesets-manage-publish.yml
│   │   ├── pre-mode.yml
│   │   └── alpha-snapshot.yml
│   └── scripts/
│       └── *.sh             # Reusable scripts
├── docs/                    # Always present (markdown docs)
├── src/                     # Single-repo: code here
├── packages/                # Mono-repo: code here (optional)
├── apps/                    # Mono-repo: apps here (optional)
├── pnpm-workspace.yaml      # Only if monorepo (gitignored by default)
├── package.json             # Always present
├── tsconfig.json
└── README.md
```

### Key Principles

**1. Convention over Configuration**

- `src/` = single package source
- `packages/` = multiple packages (opt-in)
- `apps/` = applications (opt-in)

**2. Progressive Enhancement**

- Start: Single repo with `src/`
- Grow: Add `packages/` and `pnpm-workspace.yaml`
- Scale: Add TurboRepo when builds slow down

**3. Workflow Compatibility**

- Changesets works for single or multi-package
- GitHub Actions detect structure automatically
- Pre-release mode works regardless of structure

### Best Practices from Research

#### Trunk-Based Development (GitOps Guide)

- All development on `main` branch
- Short-lived feature branches
- Environments in directories, not branches
- Clear audit trail and traceability

#### Repository Security (GitHub Docs)

- Enable Dependabot alerts
- Enable secret scanning and push protection
- Enable code scanning (CodeQL)
- Add `SECURITY.md` file

#### DRY Principle (GitOps Guide)

- Use Kustomize/Helm patterns for configuration
- Avoid duplicating YAML across environments
- Leverage templating and patching tools

#### Separate Concerns

- Keep application code separate from configuration
- Independent lifecycles for code and infrastructure
- Decoupled approval processes

---

## 5. Immediate Action Plan

### Phase 1: Add Docusaurus (Now)

**Why now:**

- Improves project professionalism
- Makes documentation discoverable
- No structural changes required
- Low risk, high value

**Tasks:**

1. Initialize Docusaurus in `website/` directory
2. Configure to use existing `docs/` folder
3. Add deployment workflow
4. Update README with docs link

**Time estimate:** 2-4 hours

---

### Phase 2: Evaluate Workspaces (Later)

**When to revisit:**

- After 10+ npm packages published
- When you split CLI from library
- When shared TypeScript configs become painful

**Decision criteria:**

- Do we have 2+ publishable packages? → Yes = Workspaces
- Are builds taking 2+ minutes? → Yes = Consider TurboRepo
- Is dependency management complex? → Yes = Workspaces

**Time estimate:** 1-2 days (migration + testing)

---

### Phase 3: Scale with TurboRepo (Future)

**When to revisit:**

- Builds exceed 5 minutes
- Team grows beyond 10 developers
- Need remote caching for CI/CD

**Decision criteria:**

- Build performance is a bottleneck? → Yes = TurboRepo
- Want to share cache across team? → Yes = TurboRepo
- Need task orchestration? → Yes = TurboRepo

**Time estimate:** 1-2 days (setup + optimization)

---

## 6. Comparison Matrix

| Aspect          | Current (Single Repo) | + Docusaurus     | + Workspaces | + TurboRepo      |
| --------------- | --------------------- | ---------------- | ------------ | ---------------- |
| **Packages**    | 1                     | 1 + docs         | 2+           | 2+               |
| **Complexity**  | Low                   | Low              | Medium       | Medium-High      |
| **Build Time**  | ~30s                  | ~30s + 2min docs | ~1-2min      | ~10-30s (cached) |
| **Setup Time**  | 0                     | 2-4h             | 1-2d         | 1-2d             |
| **Maintenance** | Low                   | Low              | Medium       | Medium           |
| **When to Use** | Always                | Now              | 2+ packages  | Slow builds      |
| **ROI**         | N/A                   | High             | Medium       | High (at scale)  |

---

## 7. Research Sources

This document synthesizes research from:

1. **pnpm Workspaces Architecture**
   [jsdev.space - Complete Monorepo Guide (2025)](https://jsdev.space/monorepo-pnpm/)
   - Content-addressable storage (CAS) architecture
   - Hard links vs symlinks
   - Topological sorting for dependency graphs

2. **TurboRepo vs pnpm Comparison**
   [ekino.fr - Monorepo Insights](https://www.ekino.fr/publications/monorepo-insights-nx-turborepo-and-pnpm)
   - "TurboRepo = pnpm Workspace + Build Optimization"
   - Performance benchmarks
   - When to use each tool

3. **Docusaurus Monorepo Integration**
   [turborepo.com - Structuring a repository](https://turbo.build/repo/docs/crafting-your-repository/structuring-a-repository)
   - `apps/` and `packages/` conventions
   - Workspace setup patterns

4. **GitOps Repository Patterns**
   [Medium - Monorepo vs Polyrepo Best Practices](https://medium.com/google-cloud/the-gitops-repository-structure-monorepo-vs-polyrepo-and-best-practices-17399ae6f3f4)
   - Trunk-based development
   - DRY principle for YAML
   - Security and governance

5. **GitHub Repository Best Practices**
   [GitHub Docs - Best practices for repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories)
   - Security features (Dependabot, secret scanning, CodeQL)
   - Branching vs forking
   - Git LFS for large files

6. **Monorepo vs Multi-Repo Discussion**
   [Stack Overflow - One big Git repo or multiple smaller ones](https://stackoverflow.com/questions/43634596/one-big-git-repo-or-multiple-smaller-ones)
   - Real-world team experiences
   - CI/CD considerations
   - Submodule patterns

7. **GitLab CI/CD for Monorepos**
   [GitLab Blog - Building CI/CD for monorepo](https://about.gitlab.com/blog/building-a-gitlab-ci-cd-pipeline-for-a-monorepo-the-easy-way/)
   - Conditional pipeline includes
   - `rules:changes` patterns
   - Directory-based triggers

---

## 8. Key Takeaways

### For chatline Project

1. **Add Docusaurus now** - High value, low complexity, no structural changes
2. **Keep single-repo structure** - No need for workspaces until you have
   multiple packages
3. **Defer TurboRepo** - Build performance is not a bottleneck yet
4. **Design for flexibility** - Use conventions that scale (src/ → packages/ →
   apps/)

### For Git Template Strategy

1. **Convention-based structure** - `src/` for single, `packages/` for multi
2. **Progressive enhancement** - Start simple, add complexity as needed
3. **Workflow-agnostic** - Changesets + GitHub Actions work for both patterns
4. **Security-first** - Enable Dependabot, secret scanning, CodeQL from day 1

### Architecture Philosophy

> "Start with the simplest thing that could possibly work, then optimize when
> you have data showing where the bottlenecks are."

- ✅ Single repo → Add Docusaurus → Evaluate workspaces → Consider TurboRepo
- ❌ Jump straight to complex monorepo + TurboRepo setup

---

## 9. Next Steps

1. **Review this document** - Discuss with team
2. **Decision: Add Docusaurus?** - If yes, follow Phase 1 plan
3. **Create template repo** - Set up flexible structure for future projects
4. **Document patterns** - Add to team knowledge base

---

**Last Updated:** 2025-11-16 **Status:** Recommendations ready for review
**Decision Required:** Proceed with Docusaurus integration?
