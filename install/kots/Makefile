CHANNEL_STABLE = Stable
CHANNEL_BETA = Beta
CHANNEL_UNSTABLE = Unstable
YAML_DIR = manifests

all: logo lint create_dev_release

create_dev_release:
	@if [ "${REPLICATED_DEV_CHANNEL}" = "" ]; then \
		echo "Please configure a REPLICATED_DEV_CHANNEL variable"; \
		exit 1; \
	fi

	@if [ "${REPLICATED_DEV_CHANNEL}" = "${CHANNEL_STABLE}" ] || [ "${REPLICATED_DEV_CHANNEL}" = "${CHANNEL_BETA}" ] || [ "${REPLICATED_DEV_CHANNEL}" = "${CHANNEL_UNSTABLE}" ]; then \
		echo "${REPLICATED_DEV_CHANNEL} is a reserved channel"; \
		exit 1; \
	fi

	replicated release create --lint --ensure-channel --yaml-dir ${YAML_DIR} --promote ${REPLICATED_DEV_CHANNEL} --version="$(shell date +%s)"
.PHONY: create_dev_release

create_unstable_release:
	replicated release create --lint --ensure-channel --yaml-dir ${YAML_DIR} --promote ${CHANNEL_UNSTABLE}
.PHONY: create_unstable_release

logo:
	@echo "Generating Base64 logo and saving to manifests/kots-app.yaml"

	$(shell yq w -i manifests/kots-app.yaml spec.icon "data:image/png;base64,$$(cat logo.png | base64 -w 0)")
.PHONY: logo

lint:
	replicated release lint --yaml-dir ${YAML_DIR}
.PHONY: lint

