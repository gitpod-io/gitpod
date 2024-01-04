CHANNEL_STABLE = Stable
CHANNEL_BETA = Beta
CHANNEL_UNSTABLE = Unstable
CHARTS_DIR = charts
YAML_DIR = manifests

all: generate_preflight_checks logo helm lint create_dev_release

create_dev_release:
	@if [ "${REPLICATED_DEV_CHANNEL}" = "" ]; then \
		echo "Please configure a REPLICATED_DEV_CHANNEL variable"; \
		exit 1; \
	fi

	@if [ "${REPLICATED_DEV_CHANNEL}" = "${CHANNEL_STABLE}" ] || [ "${REPLICATED_DEV_CHANNEL}" = "${CHANNEL_BETA}" ] || [ "${REPLICATED_DEV_CHANNEL}" = "${CHANNEL_UNSTABLE}" ]; then \
		echo "${REPLICATED_DEV_CHANNEL} is a reserved channel"; \
		exit 1; \
	fi

	replicated release create --lint --ensure-channel --yaml-dir ${YAML_DIR} --promote ${REPLICATED_DEV_CHANNEL} --version="release-2022.11.4-rc5"
.PHONY: create_dev_release

create_unstable_release:
	replicated release create --lint --ensure-channel --yaml-dir ${YAML_DIR} --promote ${CHANNEL_UNSTABLE}
.PHONY: create_unstable_release

generate_preflight_checks:
	@echo "Generating installation config validation preflight check"

# Extract the installer job
	@yq r manifests/gitpod-installer-job.yaml spec.template.spec > /tmp/installer-job.yaml
# Remove the envFrom block
	@yq d -i /tmp/installer-job.yaml containers[0].envFrom

# Extract the envFrom block as envvars and convert to "env" format
	@yq r -j manifests/gitpod-kots-config.yaml data > /tmp/installer-envvars.json

	@for row in $$(cat /tmp/installer-envvars.json | jq -r 'to_entries | .[] | @base64'); do \
		yq w -i /tmp/installer-job.yaml containers[0].env[+].name "$$(echo $${row} | base64 -d | jq -r '.key')"; \
		yq w -i /tmp/installer-job.yaml containers[0].env[-1].value "$$(echo $${row} | base64 -d | jq -r '.value')"; \
	done

# Set as dry run
	@yq w -i /tmp/installer-job.yaml containers[0].env[+].name "INSTALLER_DRY_RUN"
	@yq w --tag=!!str -i /tmp/installer-job.yaml containers[0].env[-1].value "true"

# Merge the envvars into the installer job
	@yq p -i /tmp/installer-job.yaml spec.collectors[0].runPod.podSpec
	@yq m -i manifests/kots-preflight.yaml /tmp/installer-job.yaml
.PHONY: generate_preflight_checks

helm:
	@echo "Installing Helm dependencies"
	@rm -f ${YAML_DIR}/*.tgz
	@for f in $(shell ls -d ${CHARTS_DIR}/*/); do cd $${f} && helm dep up && helm package . --destination ../../${YAML_DIR} && cd -; done
.PHONY: helm

logo:
	@echo "Generating Base64 logo and saving to manifests/kots-app.yaml"

	$(shell yq w -i manifests/kots-app.yaml spec.icon "data:image/png;base64,$$(cat logo.png | base64 -w 0)")
.PHONY: logo

lint:
	@if [ "${REPLICATED_API_TOKEN}" != "" ] && [ "${REPLICATED_APP}" != "" ]; then \
		replicated release lint --yaml-dir ${YAML_DIR}; \
	else \
		echo "REPLICATED_API_TOKEN and REPLICATED_APP are not set. Skipping"; \
	fi
.PHONY: lint
