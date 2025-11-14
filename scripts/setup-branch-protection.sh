#!/usr/bin/env bash
set -euo pipefail
# Setup GitHub branch protection rules with sensible defaults
#
# Usage:
#   ./scripts/setup-branch-protection.sh [OPTIONS] [OWNER] [REPO] [BRANCH]
#
# Options:
#   --no-pr-requirement    Disable PR requirement (for debugging)
#   --debug                Same as --no-pr-requirement
#
# Arguments:
#   OWNER   GitHub username/org (default: nathanvale)
#   REPO    Repository name (default: imessage-timeline)
#   BRANCH  Branch to protect (default: main)
#
# Examples:
#   ./scripts/setup-branch-protection.sh
#   ./scripts/setup-branch-protection.sh --debug
#   ./scripts/setup-branch-protection.sh myuser myrepo develop

# Disable pagers that may hijack output in some environments
export GH_PAGER=""
export PAGER=""
export GIT_PAGER=""

# Parse flags
REQUIRE_PR=true
while [[ $# -gt 0 ]]; do
  case $1 in
    --no-pr-requirement)
      REQUIRE_PR=false
      shift
      ;;
    --debug)
      REQUIRE_PR=false
      shift
      ;;
    *)
      break
      ;;
  esac
done

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
if [ "$REQUIRE_PR" = true ]; then
  echo "Configuring repo: $REPO_SLUG (branch: $BRANCH) [PR required, no approvals needed]"
else
  echo "Configuring repo: $REPO_SLUG (branch: $BRANCH) [DEBUG MODE: PR requirement disabled]"
fi

echo "Enabling auto-merge on repository..."
gh repo edit "$REPO_SLUG" --enable-auto-merge >/dev/null

echo "Configuring repository merge options (squash only, auto-delete head branches)..."
gh api -X PATCH -H "Accept: application/vnd.github+json" \
  "repos/$REPO_SLUG" \
  -f allow_squash_merge=true \
  -f allow_merge_commit=false \
  -f allow_rebase_merge=false \
  -f delete_branch_on_merge=true \
  -f allow_auto_merge=true >/dev/null

echo "Allowing GitHub Actions to create and approve pull requests..."
gh api -X PUT -H "Accept: application/vnd.github+json" \
  "repos/$REPO_SLUG/actions/permissions/workflow" \
  -f default_workflow_permissions='write' \
  -F can_approve_pull_request_reviews=true >/dev/null

echo "Applying branch protection rules..."

if [ "$REQUIRE_PR" = true ]; then
  read -r -d '' BODY <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "PR quality / gate",
      "Commitlint / commitlint",
      "PR Title Lint / lint"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
JSON
else
  read -r -d '' BODY <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "PR quality / gate",
      "Commitlint / commitlint",
      "PR Title Lint / lint"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false
}
JSON
fi

printf '%s' "$BODY" | gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$REPO_SLUG/branches/$BRANCH/protection" \
  --input - >/dev/null

echo "Enforcing signed commits on branch..."
gh api -X POST -H "Accept: application/vnd.github+json" \
  "repos/$REPO_SLUG/branches/$BRANCH/protection/required_signatures" >/dev/null || true

if [ "$REQUIRE_PR" = true ]; then
  echo "✅ Done. Branch protection configured with PR requirement (0 approvals needed)."
else
  echo "✅ Done. Branch protection configured in DEBUG MODE (no PR requirement)."
fi
