.PHONY: lint-actions
lint-actions:
	@if ! command -v actionlint >/dev/null 2>&1; then \
		echo "actionlint is not installed. Install it with: brew install actionlint"; \
		exit 1; \
	fi; \
	actionlint -color -verbose
