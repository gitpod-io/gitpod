.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "/workspace/conf"

cloud_k3s := "gcp"
cloud_gke := "gcp"
cloud_aks := "azure"
cloud_eks := "aws"


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

cluster ?= gke
.PHONY:
## create-cluster: Creates a cluster
create-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cluster) -var kubeconfig=${KUBECONFIG} --auto-approve

cluster ?= gke
.PHONY:
## cleanup-cluster: Creates a cluster
cleanup-cluster: select-workspace
	terraform destroy -target=module.$(cluster) -var kubeconfig=${KUBECONFIG} --auto-approve

cluster ?= gke
.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record: cloud = $(cloud_$(cluster))
add-ns-record:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-add-ns-record  -var kubeconfig=${KUBECONFIG} --auto-approve

cluster ?= gke
.PHONY:
## cleanup-ns-record: Deletes NS record for subdomain under gitpod-selfhosted.com
cleanup-ns-record: cloud = $(cloud_$(cluster))
cleanup-ns-record: select-workspace
	terraform destroy -target=module.$(cloud)-add-ns-record  -var kubeconfig=${KUBECONFIG} --auto-approve

cluster ?= gke
.PHONY:
## cluster-issuer: Creates a cluster issuer
cluster-issuer: cloud = $(cloud_$(cluster))
cluster-issuer:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-issuer  -var kubeconfig=${KUBECONFIG} --auto-approve

CLUSTER_ISSUER_CLOUD_DNS := "./manifests/gcp-issuer.yaml"

.PHONY:
## cert-manager: Installs cert-manager, optionally create secret for cloud-dns access
cert-manager:
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve

cluster ?= gke
.PHONY:
## external-dns: Installs external-dns
external-dns: cloud = $(cloud_$(cluster))
external-dns: check-env-sub-domain
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve

    # kubectl --kubeconfig=${KUBECONFIG} apply -f ${CLUSTER_ISSUER_CLOUD_DNS}

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	${KUBECONFIG}

KOTS_KONFIG := "./manifests/kots-config.yaml"

get-base-config:
	envsubst < ${KOTS_KONFIG} > tmp_config.yml

storage-config-aws:
	@echo "Nothing to do"

db-config-aws:
	@echo "Nothing to do"

registry-config-aws:
	@echo "Nothing to do"

storage-config-incluster:
	@echo "Nothing to do"

db-config-incluster:
	@echo "Nothing to do"

registry-config-incluster:
	@echo "Nothing to do"

storage-config-gcp: config-file = "./manifests/kots-config-gcp-storage.yaml"
storage-config-gcp:
	export BASE64_GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst '$${BASE64_GCP_KEY}' < ${config-file} > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-gcp: config-file = "./manifests/kots-config-gcp-registry.yaml"
registry-config-gcp:
	export GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst '$${GCP_KEY}' < ${config-file} > tmp_4_config.yml
	yq m -i tmp_config.yml tmp_4_config.yml

db-config-gcp: config-file = "./manifests/kots-config-gcp-db.yaml"
db-config-gcp:
	export BASE64_GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst '$${BASE64_GCP_KEY}' < ${config-file} > tmp_4_config.yml
	envsubst '$${TF_VAR_TEST_ID}' < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

storage-config-azure:
	export PASSWORD=$$(terraform output -json storage | yq r - 'password') && \
	export USERNAME=$$(terraform output -json storage | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

db-config-azure:
	export DBHOST=$$(terraform output -json database | yq r - 'host') && \
	export DBPASS=$$(terraform output -json database | yq r - 'password') && \
	export DBUSER=$$(terraform output -json database | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-azure:
	export SERVER=$$(terraform output -json registry | yq r - 'server') && \
	export PASSWORD=$$(terraform output -json registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage ?= incluster
registry ?= incluster
db ?= incluster
.PHONY:
generate-kots-config: storage = $(if $(storage:incluster=),$(cloud_$(storage)),$(storage))
generate-kots-config: registry = $(if $(registry:incluster=),$(cloud_$(registry)),$(registry))
generate-kots-config: registry = $(if $(registry:db=),$(cloud_$(db)),$(db))
## generate-kots-config: Generate the kots config based on test config
generate-kots-config: get-base-config storage-config-${storage} registry-config-${registry} db-config-${db}

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

select-workspace:
	terraform workspace select $(TF_VAR_TEST_ID)

cluster ?= gke
## cleanup: Clean up the created infrastructure
cleanup: cloud = $(cloud_$(cluster))
cleanup: select-workspace
	terraform destroy -target=module.$(cloud)-add-ns-record -var kubeconfig=${KUBECONFIG} --auto-approve
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.$(cloud)-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.$(cloud)-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.$(cluster) -var kubeconfig=${KUBECONFIG} --auto-approve

get-results:
	@echo "If you have gotten this far, it means your setup succeeded"
	@echo "The IP address of you setup is "$(TF_VAR_TEST_ID).gitpod-self-hosted.com""
	@echo "Following is the KUBECONFIG you can use to connect to the cluster:"
	@cat ${KUBECONFIG}

list-state:
	terraform state list
# end
