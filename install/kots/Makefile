CHANNEL_STABLE = Stable
CHANNEL_BETA = Beta
CHANNEL_UNSTABLE = Unstable
YAML_DIR = manifests

all: helm lint create_unstable_release

create_unstable_release:
	replicated release create --lint --yaml-dir ${YAML_DIR} --promote ${CHANNEL_UNSTABLE}
.PHONY: create_unstable_release

lint:
	replicated release lint --yaml-dir ${YAML_DIR}
.PHONY: lint

helm:
	@echo "Installing Helm dependencies"
	@rm -f manifests/*.tgz
	@for f in $(shell ls -d charts/*/); do cd $${f} && helm dep up && helm package . --destination ../../manifests && cd -; done
.PHONY: helm
