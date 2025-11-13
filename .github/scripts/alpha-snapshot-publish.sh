#!/usr/bin/env bash
# Perform an alpha snapshot version and publish. Requires NPM_TOKEN and GITHUB_TOKEN in env.

set -euo pipefail

pnpm changeset version --snapshot alpha
pnpm changeset publish --tag alpha
