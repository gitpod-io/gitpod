.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "$(TOPDIR)/kubeconfig"

check-env-sub-domain:
ifndef TF_VAR_sub_domain
	$(error TF_VAR_sub_domain is not defined)
endif

.PHONY: help
all: help
help: Makefile
	@echo
	@echo " Choose a command to run in "$(PROJECTNAME)":"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

.PHONY:
## gke-standard-cluster: Creates a zonal GKE cluster
gke-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_sub_domain) && \
	terraform apply -target=module.gke \
	-var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## k3s-standard-cluster: Creates a K3S cluster on GCP with one master and 1 worker node
k3s-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_sub_domain) && \
	terraform apply -target=module.k3s \
	-var kubeconfig=${KUBECONFIG} --auto-approve


CLUSTER_ISSUER_CLOUD_DNS := "./manifests/gcp-issuer.yaml"

.PHONY:
## managed-dns-with-cert-manager: Installs cert-manager, external-dns, and setup up CloudDNS
managed-dns-with-cert-manager: check-env-sub-domain
	terraform apply -target=module.tools -var kubeconfig=${KUBECONFIG} --auto-approve && \
	kubectl --kubeconfig=${KUBECONFIG} apply -f ${CLUSTER_ISSUER_CLOUD_DNS}

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	${KUBECONFIG}

KOTS_KONFIG := "./manifests/kots-config.yaml"
CHANNEL = "gitpod/unstable"
COMMUNITY_LICENSE := "../licenses/Community.yaml"

install-kots-cli:
	curl https://kots.io/install | bash

kots-install-without-preflight-with-community-license: install-kots-cli
	envsubst < ${KOTS_KONFIG} > tmp_config.yml
	kubectl kots install ${CHANNEL} \
	--skip-rbac-check --skip-preflights --namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${COMMUNITY_LICENSE} \
                    --no-port-forward \
                    --config-values tmp_config.yml

kots-install-with-community-license: install-kots-cli
	envsubst < ${KOTS_KONFIG} > tmp_config.yml
	kubectl kots install ${CHANNEL} \
	--skip-rbac-check --namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${COMMUNITY_LICENSE} \
                    --no-port-forward \
                    --config-values tmp_config.yml

check-gitpod-installation:
	sleep 120
	kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager
	sleep 300
	kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $2}'

cleanup:
	terraform destroy -var kubeconfig=${KUBECONFIG} --auto-approve

get-results:
	@echo "If you have gotten this far, it means your setup succeeded"
	@echo
	@echo "URL of your setup is: "https://$(TF_VAR_sub_domain).gitpod-self-hosted.com""
	@echo
	@echo "Following is the KUBECONFIG you can use to connect to the cluster:"
	@echo
	@cat ${KUBECONFIG}

list-state:
	terraform state list
# end
