#!/usr/bin/env bash
# Perform an alpha snapshot version and publish. Requires NPM_TOKEN and GITHUB_TOKEN in env.

set -euo pipefail

annotate() {
	local level="${1:-notice}" # notice|warning
	local msg="${2:-}"
	case "$level" in
		warning) echo "::warning::${msg}" ;;
		*) echo "::notice::${msg}" ;;
	esac
	if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
		{
			echo "## Alpha Snapshot Publish"
			echo "${msg}"
		} >>"$GITHUB_STEP_SUMMARY"
	fi
}

if [[ -z "${NPM_TOKEN:-}" ]] || [[ -z "${GITHUB_TOKEN:-}" ]]; then
	missing=()
	[[ -z "${NPM_TOKEN:-}" ]] && missing+=("NPM_TOKEN")
	[[ -z "${GITHUB_TOKEN:-}" ]] && missing+=("GITHUB_TOKEN")
	annotate warning "Missing required secrets: ${missing[*]}. Skipping alpha snapshot publish."
	exit 0
fi

# Authenticate npm for publish
{
	echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
} > "$HOME/.npmrc"

annotate notice "Publishing alpha snapshot via Changesets (version snapshot + npm publish)."

pnpm changeset version --snapshot alpha
pnpm changeset publish --tag alpha
