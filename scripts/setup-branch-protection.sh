#!/usr/bin/env bash
set -euo pipefail

OWNER=${1:-nathanvale}
REPO=${2:-imessage-timeline}
BRANCH=${3:-main}

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install from https://cli.github.com/" >&2
  exit 1
fi

echo "Checking gh auth status..."
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "You are not logged in to gh. Run: gh auth login" >&2
  exit 1
fi

REPO_SLUG="$OWNER/$REPO"
echo "Configuring repo: $REPO_SLUG (branch: $BRANCH)"

echo "Enabling auto-merge on repository..."
# --enable-auto-merge is idempotent
gh repo edit "$REPO_SLUG" --enable-auto-merge >/dev/null

echo "Applying branch protection (required checks, reviews, linear history, signed commits)..."
read -r -d '' BODY <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "PR quality / Lint",
      "PR quality / Typecheck",
      "PR quality / Tests + Coverage",
      "PR quality / Repo quality checks",
      "Commitlint / commitlint",
      "PR Title Lint / lint"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": {
    "users": [],
    "teams": [],
    "apps": ["github-actions"]
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
JSON

# Apply protection
printf '%s' "$BODY" | gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$REPO_SLUG/branches/$BRANCH/protection" \
  --input - >/dev/null

echo "Enforcing signed commits on branch..."
# Separate endpoint for required signatures
# This is idempotent; returns 204 when enabling, 201 in some scenarios.
gh api -X POST -H "Accept: application/vnd.github+json" \
  "repos/$REPO_SLUG/branches/$BRANCH/protection/required_signatures" >/dev/null || true

echo "Done. Branch protection and auto-merge configured."
