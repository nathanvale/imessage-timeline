# actionlint quickstart

This is a short, practical guide for using actionlint locally in this repo.

## Install

- macOS: `brew install actionlint`
- Linux: see releases at https://github.com/rhysd/actionlint

## Pre-commit behavior

- When you commit changes that include `.github/workflows/*.yml|yaml`, the
  pre-commit hook will:
  - Run lint-staged + quality checks
  - Run actionlint on JUST the staged workflow files
- If actionlint is not installed, the hook prints:
  - `actionlint is not installed. Skipping workflow lint.`
  - `Install it: brew install actionlint`

## Run manually

- Lint all workflows:
  - `make lint-actions`
- Lint specific files:
  - `actionlint -no-color -oneline .github/workflows/workflow-lint.yml`

## CI gate

- CI runs actionlint on PRs and pushes that touch `.github/workflows/**`.
- Flags are configured in `/.github/workflows/workflow-lint.yml`.

## Notes

- Python snippet checks (pyflakes) are optional. If missing, actionlint will
  note that the rule is disabled; this is fine unless you need Python linting
  inside workflow steps.
- For deeper guidance, see `docs/actionlint-best-practices.md`.
