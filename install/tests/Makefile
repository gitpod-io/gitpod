.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "$(TOPDIR)/kubeconfig"

check-env-sub-domain:
ifndef TF_VAR_TEST_ID
	$(error TF_VAR_TEST_ID is not defined)
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
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## k3s-standard-cluster: Creates a K3S cluster on GCP with one master and 1 worker node
k3s-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.k3s -var kubeconfig=${KUBECONFIG} --auto-approve

CLUSTER_ISSUER_CLOUD_DNS := "./manifests/gcp-issuer.yaml"

.PHONY:
## cert-manager: Installs cert-manager, optionally create secret for cloud-dns access
cert-manager:
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve && \
	kubectl --kubeconfig=${KUBECONFIG} apply -f ${CLUSTER_ISSUER_CLOUD_DNS}

.PHONY:
## managed-dns: Installs external-dns, and setup up CloudDNS access
managed-dns: check-env-sub-domain
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.externaldns -var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	${KUBECONFIG}

KOTS_KONFIG := "./manifests/kots-config.yaml"
license_community_beta := "../licenses/Community (Beta).yaml"
license_community_stable := "../licenses/Community.yaml"
license_community_unstable := "../licenses/Community (Unstable).yaml"

install-kots-cli:
	curl https://kots.io/install | bash

preflights ?= true
channel ?= unstable
version ?= -
kots-install: version-flag = $(if $(version:-=),--app-version-label=$(version),)
kots-install: preflight-flag = $(if $(preflights:true=),--skip-preflights,)
kots-install: license-file =  $(license_community_$(channel))
kots-install: install-kots-cli
	envsubst < ${KOTS_KONFIG} > tmp_config.yml
	kubectl kots install gitpod/${channel} \
	--skip-rbac-check ${version-flag} ${preflight-flag} \
					--namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${license-file} \
                    --no-port-forward \
                    --config-values tmp_config.yml

delete-cm-setup:
	sleep 120 && kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager && sleep 300;

check-kots-app:
	kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $$2}' | grep "ready" || { echo "Gitpod is not ready"; exit 1; }

check-gitpod-installation: delete-cm-setup check-kots-app check-env-sub-domain
	@echo "Curling http://${TF_VAR_TEST_ID}.gitpod-self-hosted.com/api/version"
	curl -i -X GET http://${TF_VAR_TEST_ID}.gitpod-self-hosted.com/api/version || { echo "Curling Gitpod endpoint failed"; exit 1; }

run-tests:
	./tests.sh ${KUBECONFIG}

cleanup:
	terraform workspace select $(TF_VAR_TEST_ID)
	which ${KUBECONFIG} && terraform destroy -target=module.externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	which ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve
	terraform destroy -target=module.k3s -var kubeconfig=${KUBECONFIG} --auto-approve

get-results:
	@echo "If you have gotten this far, it means your setup succeeded"
	@echo
	@echo "URL of your setup is: "https://$(TF_VAR_TEST_ID).gitpod-self-hosted.com""
	@echo
	@echo "Following is the KUBECONFIG you can use to connect to the cluster:"
	@echo
	@cat ${KUBECONFIG}

list-state:
	terraform state list
# end
