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
## aks-standard-cluster: Creates an AKS cluster
aks-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## azure-external-dns: Sets up external-dns with azure provider
azure-external-dns:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.azure-externaldns  -var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.add_gcp_nameservers  -var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## azure-issuer: Creates a cluster issuer with AD access
azure-issuer:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.azure-issuer  -var kubeconfig=${KUBECONFIG} --auto-approve

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
	terraform apply -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve

.PHONY:
## managed-dns: Installs external-dns, and setup up CloudDNS access
managed-dns: check-env-sub-domain
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.externaldns -var kubeconfig=${KUBECONFIG} --auto-approve && \
    kubectl --kubeconfig=${KUBECONFIG} apply -f ${CLUSTER_ISSUER_CLOUD_DNS}

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	${KUBECONFIG}

KOTS_KONFIG := "./manifests/kots-config.yaml"

.PHONY:
## generate-kots-config: Generate the kots config based on test config
generate-kots-config:
	envsubst < ${KOTS_KONFIG} > tmp_config.yml

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
kots-install: license-file = $(if $(license_community_$(channel)),$(license_community_$(channel)),"../licenses/$(channel).yaml")
kots-install: install-kots-cli
	kubectl kots install gitpod/${channel} \
	--skip-rbac-check ${version-flag} ${preflight-flag} \
					--namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${license-file} \
                    --no-port-forward \
                    --config-values tmp_config.yml

delete-cm-setup:
	sleep 300 && kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager && sleep 600;

check-kots-app:
	kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $$2}' | grep "ready" || { echo "Gitpod is not ready"; exit 1; }

check-gitpod-installation: delete-cm-setup check-kots-app check-env-sub-domain
	@echo "Curling http://${TF_VAR_TEST_ID}.gitpod-self-hosted.com/api/version"
	curl -i -X GET http://${TF_VAR_TEST_ID}.gitpod-self-hosted.com/api/version || { echo "Curling Gitpod endpoint failed"; exit 1; }

run-tests:
	./tests.sh ${KUBECONFIG}

kots-uprgade:
	@echo "Upgrade gitpod KOTS app to latest"
	kubectl kots upstream upgrade --kubeconfig=${KUBECONFIG} gitpod -n gitpod --deploy

cleanup: destroy-gcp-externaldns destroy-gcpns destroy-aks-edns destroy-aks-issuer destroy-certmanager destroy-k3s destroy-gke destroy-aks

select-workspace:
	terraform workspace select $(TF_VAR_TEST_ID)

destroy-gcp-externaldns: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"

destroy-certmanager: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"

destroy-gcpns: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.add_gcp_nameservers -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"

destroy-aks-edns: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.azure-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-aks-issuer: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.azure-issuer -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-gke: select-workspace
	terraform destroy -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-k3s: select-workspace
	terraform destroy -target=module.k3s -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-aks: select-workspace
	terraform destroy -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve

get-results:
	@echo "If you have gotten this far, it means your setup succeeded"
	@echo "The IP address of you setup is "$(TF_VAR_TEST_ID).gitpod-self-hosted.com""
	@echo "Following is the KUBECONFIG you can use to connect to the cluster:"
	@cat ${KUBECONFIG}

list-state:
	terraform state list
# end
