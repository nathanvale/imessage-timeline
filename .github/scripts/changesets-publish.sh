#!/usr/bin/env bash
# Purpose: Safely invoke `changeset publish` via `pnpm release` only when NPM_TOKEN is available.
# This prevents the Changesets workflow from failing on main for repositories that haven't
# configured publishing yet. When NPM_TOKEN is set, we authenticate and publish normally.

set -euo pipefail

if [[ -z "${NPM_TOKEN:-}" ]]; then
  echo "[changesets-publish] NPM_TOKEN not set; skipping publish step."
  exit 0
fi

# Authenticate npm for publish
# Note: pnpm respects ~/.npmrc for auth to npm registry
{
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
} > "$HOME/.npmrc"

# Run the project's publish script (configured to call `changeset publish`)
pnpm release
