.PHONY: lint-actions
lint-actions:
	@which actionlint >/dev/null 2>&1 || { echo "actionlint not installed. Install with: brew install actionlint"; exit 1; }
	actionlint -color -verbose
