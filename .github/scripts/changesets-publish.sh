#!/usr/bin/env bash
# Purpose: Safely invoke `changeset publish` via `pnpm release` only when NPM_TOKEN is available.
# This prevents the Changesets workflow from failing on main for repositories that haven't
# configured publishing yet. When NPM_TOKEN is set, we authenticate and publish normally.

set -euo pipefail

annotate() {
  local level="$1" # notice|warning
  local msg="$2"
  case "$level" in
    warning) echo "::warning::${msg}" ;;
    *) echo "::notice::${msg}" ;;
  esac
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Changesets Publish"
      echo "${msg}"
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

if [[ -z "${NPM_TOKEN:-}" ]]; then
  annotate warning "NPM_TOKEN not set; skipping publish. Configure repository secret 'NPM_TOKEN' to enable publishing."
  exit 0
fi

# Authenticate npm for publish
# Note: pnpm respects ~/.npmrc for auth to npm registry
{
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
} > "$HOME/.npmrc"

echo "::group::Configure npm auth"
echo "Wrote npm auth token to ~/.npmrc"
echo "::endgroup::"

annotate notice "NPM_TOKEN detected; attempting publish via 'pnpm release'."

# Run the project's publish script (configured to call `changeset publish`)
pnpm release
