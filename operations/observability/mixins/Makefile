JSONNET_FMT := jsonnetfmt -n 2 --max-blank-lines 2 --string-style s --comment-style s

all: fmt lint

.PHONY: clean
clean:
    # Delete files marked in .gitignore
	git clean -Xfd .

.PHONY: fmt
fmt:
	find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
		xargs -n 1 -- $(JSONNET_FMT) -i

.PHONY: lint
lint:
	find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
		while read f; do \
			$(JSONNET_FMT) "$$f" | diff -u "$$f" -; \
		done

.PHONY: prometheus_alerts.yaml
prometheus_alerts.yaml:
	jsonnet -S alerts.jsonnet > $@

.PHONY: promtool-lint
promtool-lint: prometheus_alerts.yaml
	promtool check rules prometheus_alerts.yaml

.PHONY: vendor
vendor:
	jb install

.PHONY: unit-tests
unit-tests: vendor
	@echo 'Testing dashboard datasources'
	jsonnet tests/dashboardDatasources.jsonnet -J vendor/
	@echo 'Testing alert severity labels'
	jsonnet tests/alertsSeverityLabel.jsonnet -J vendor/
	@echo 'Testing alert descripion annotation'
	jsonnet tests/alertsDescriptionAnnotation.jsonnet -J vendor/
