.DEFAULT_GOAL:=help

# HELP
# https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help

help:  ## This help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

JSONNET_FMT := jsonnetfmt -n 2 --max-blank-lines 2 --string-style s --comment-style s

all: fmt lint ## Format and lint jsonnet files

clean: ## Delete files marked in .gitignore
	git clean -Xfd .

fmt: ## Format jsonnet files
	find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
		xargs -n 1 -- $(JSONNET_FMT) -i

lint: ## Lint jsonnet files
	find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
		while read f; do \
			$(JSONNET_FMT) "$$f" | diff -u "$$f" -; \
		done

prometheus_alerts.yaml: ## Create prometheus alerts yaml file
	jsonnet -S alerts.jsonnet > $@

promtool-lint: prometheus_alerts.yaml # Check generated prometheus alerts yaml file
	promtool check rules prometheus_alerts.yaml

vendor:
	jb install

unit-tests: vendor ## Run jsonnet unit tests
	@echo 'Testing alert severity labels'
	jsonnet tests/alertsSeverityLabel.jsonnet -J vendor/
	@echo 'Testing alert descripion annotation'
	jsonnet tests/alertsDescriptionAnnotation.jsonnet -J vendor/

dashboards_out: ## Generate dashboards json files
	@mkdir -p dashboards_out
	jsonnet -J vendor -m dashboards_out dashboards.jsonnet

.PHONY: help all clean fmt lint prometheus_alerts.yaml promtool-lint vendor unit-tests dashboards_out
