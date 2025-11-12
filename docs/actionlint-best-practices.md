# actionlint best practices

This doc summarizes pragmatic guidance for using actionlint effectively in CI
and locally. It includes links to authoritative sources and avoids long quotes.

## When and where to run actionlint

- Run in CI on PRs and pushes touching .github/workflows/\*\*, fail on errors
- Optionally add a pre-commit hook to lint staged workflow files for fast
  feedback
- Use Problem Matchers or reviewdog to annotate PRs with inline diagnostics

## Configuration and ignores

- Prefer repo config at .github/actionlint.yaml for persistent, scoped ignores
- Use path-scoped ignore patterns to avoid blanket disables (keep signal high)
- For unavoidable noise, prefer narrow, line-level ShellCheck disables in run
  blocks

## ShellCheck integration

- Make shell explicit: shell: bash on steps with run:
- Use quoted $(...) command substitutions and double-quote all expansions
- Prefer actions over inline scripts for complex logic; or externalize to .sh
  files
- Avoid bash-specific parameter expansions in CI unless necessary; note
  portability

## CI action wrapper best practices

- With raven-actions/actionlint, use flags (not args); enable group-result
- Pin to a commit SHA or trust the maintainer; enable cache to speed up runs
- Enable shellcheck/pyflakes where available for deeper checks

## Security hardening tie-ins

- Pin third-party actions to full-length commit SHAs
- Pass untrusted inputs via env indirection to avoid script injection pitfalls
- Set minimal GITHUB_TOKEN permissions; elevate per-job only when needed

## References

- actionlint README — https://github.com/rhysd/actionlint (Feature overview,
  checks, and links to usage/config docs)
- actionlint Usage — https://github.com/rhysd/actionlint/blob/main/docs/usage.md
  (Flags like -ignore, Docker usage, pre-commit integration)
- actionlint Configuration —
  https://github.com/rhysd/actionlint/blob/main/docs/config.md (Repository-level
  config and path-scoped ignores)
- ShellCheck SC2209 — https://www.shellcheck.net/wiki/SC2209 (Canonical guidance
  for string vs command substitutions)
- raven-actions/actionlint — https://github.com/raven-actions/actionlint (Action
  wrapper inputs: flags, version, group-result, cache)
- GitHub Actions security hardening —
  https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
  (Inline script hardening, env indirection, SHA pinning)
