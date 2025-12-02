#!/usr/bin/env bash
# Quick helper: show merge blockers for a PR.
# Usage: scripts/pr-blockers.sh <pr-number>

set -euo pipefail

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 <pr-number>" >&2
	exit 1
fi

PR="$1"

gh pr view "$PR" \
	--json mergeStateStatus,requiredReviews,reviewDecision,statusCheckRollup,title,url \
	--jq '. as $p | {
		title: $p.title,
		url: $p.url,
		mergeStateStatus: $p.mergeStateStatus,
		reviewDecision: ($p.reviewDecision // "UNKNOWN"),
		requiredReviews: $p.requiredReviews,
		statusCheckRollup: $p.statusCheckRollup | map({
			name: (.name // .context),
			state: (.state // .conclusion),
			conclusion: .conclusion
		})
	}' |
	jq
