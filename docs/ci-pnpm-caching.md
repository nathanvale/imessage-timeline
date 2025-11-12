# CI pnpm Caching Strategy

This project uses a layered caching approach to minimize install time across all
GitHub Actions workflows while keeping security and determinism.

## Goals

- Reproducible installs (lockfile + exact Node version via `.nvmrc`)
- Fast cold + warm starts across parallel jobs
- Minimal cache invalidation surface (only bust when Node version or dependency
  graph changes)
- Immutable, pinned third-party actions for supply-chain safety

## Layers

1. **Corepack + packageManager**: `corepack enable` respects
   `packageManager: pnpm@<version>` in `package.json` for deterministic pnpm
   version.
2. **setup-node built-in cache**: Each job sets `cache: 'pnpm'` (where
   meaningful) to leverage built-in caching keyed by the lockfile hash.
3. **Explicit pnpm store cache (actions/cache)**: Adds cross-job +
   cross-workflow reuse of the pnpm store with a custom key to avoid duplicate
   extraction.

## Pattern

Each workflow job that installs dependencies follows this sequence (after
checkout & Node setup):

```yaml
- name: Enable Corepack (pnpm)
  run: corepack enable

- uses: pnpm/action-setup@41ff72655975bd51cab0327fa583b6e92b6d3061 # v4.2.0
  with:
    run_install: false

- name: Get pnpm store path
  id: pnpm-store
  run: echo "PNPM_STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Cache pnpm store
  uses: actions/cache@0c45773b623bea8c8e75f6c82b208c3cf94ea4f9 # v4.0.2
  with:
    path: ${{ env.PNPM_STORE_PATH }}
    key:
      pnpm-store-${{ runner.os }}-${{ hashFiles('.nvmrc') }}-${{
      hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      pnpm-store-${{ runner.os }}-${{ hashFiles('.nvmrc') }}-

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

## Key Design Choices

| Aspect                                    | Rationale                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.nvmrc`                                  | Unifies Node across dev & CI; forms part of cache key.                                      |
| `hashFiles('pnpm-lock.yaml')`             | Busts cache when dependency graph changes.                                                  |
| `hashFiles('.nvmrc')`                     | Ensures cache isolation per Node major/minor changes.                                       |
| `restore-keys` prefix                     | Allows fallback to previous lockfile cache if only small changes occur (best-effort reuse). |
| `run_install: false` on pnpm/action-setup | Lets us control install timing after cache restore.                                         |
| Pinned SHAs                               | Eliminates supply-chain drift in CI infrastructure.                                         |

## When to Bust Cache Manually

Normally automatic. Manually invalidate if:

- Corrupt cache suspected (rare): update one character in `.nvmrc` then revert,
  or push an empty commit touching lockfile.
- Upgrading pnpm major version: update `packageManager` field (will change store
  structure => new key anyway).

## Known Trade-offs

- Adds a few extra seconds for the cache lookup step; net win when dependency
  install takes >10s.
- Duplicate layer with `cache: pnpm` is partly redundant but harmless; built-in
  cache may sometimes satisfy without hitting actions/cache. We favor redundancy
  for reliability.

## Extending the Pattern

For language additions (e.g., Python tooling) keep caches orthogonal: avoid
mixing paths in a single cache entry.

## Security Notes

- All cache-producing steps run _after_ checkout but before arbitrary build
  scripts.
- Only deterministic dependency artifacts stored. No secrets placed in cached
  directory.

## Maintenance Checklist

- Keep action SHAs periodically refreshed (dependabot / manual audit).
- Review cache hit/miss in workflow logs quarterly.
- If store format changes (pnpm release notes), ensure keys differentiate
  (Node/pnpm version combo already covers most cases).

## Related Files

- `.nvmrc` – Node version anchor.
- `package.json` – `packageManager` field for pnpm version.
- `.github/workflows/*.yml` – All relevant jobs updated.

## Future Enhancements

- Optional: Add a metrics step to log install duration and cache status (can
  feed into a dashboard).
- Optional: Introduce a weekly cache prime workflow if cold starts become
  frequent.

---

_Last updated: 2025-11-12._
