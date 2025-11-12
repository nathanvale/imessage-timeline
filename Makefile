.PHONY: lint-actions
lint-actions:
	@command -v actionlint >/dev/null 2>&1 && \
		actionlint -color -verbose || { \
		echo "actionlint is not installed. Install it with: brew install actionlint"; \
		exit 1; \
	}
