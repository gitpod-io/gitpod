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
## eks-standard-cluster: Creates an EKS cluster
eks-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.eks -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating EKS cluster"

.PHONY:
## aks-standard-cluster: Creates an AKS cluster
aks-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating AKS cluster"

cloud ?= azure
.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-add-dns-record  -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done adding NS record"

cloud ?= azure
.PHONY:
## cluster-issuer: Creates a cluster issuer for the correspondign provider
cluster-issuer:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-issuer  -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating cluster issuer"

.PHONY:
## k3s-standard-cluster: Creates a K3S cluster on GCP with one master and 1 worker node
k3s-standard-cluster:
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.k3s -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating k3s cluster"

.PHONY:
## cert-manager: Installs cert-manager, optionally create secret for cloud-dns access
cert-manager:
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done installing cert-manager"

.PHONY:
## managed-dns: Installs external-dns, and setup up CloudDNS access
managed-dns: check-env-sub-domain
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.clouddns-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done created GCP managed DNS"

cloud ?= "azure"
.PHONY:
## external-dns: Installs external-dns
external-dns: check-env-sub-domain
	terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating externaldns for ${cloud}"

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	${KUBECONFIG}

KOTS_KONFIG := "./manifests/kots-config.yaml"

get-base-config:
	envsubst < ${KOTS_KONFIG} > tmp_config.yml

get-config-incluster:
	@echo "Nothing to do"

get-config-gcp-storage: config-file = "./manifests/kots-config-gcp-storage.yaml"
get-config-gcp-storage:
	export BASE64_GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst '$${BASE64_GCP_KEY}' < ${config-file} > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

get-config-gcp-registry: config-file = "./manifests/kots-config-gcp-registry.yaml"
get-config-gcp-registry:
	export GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst '$${GCP_KEY}' < ${config-file} > tmp_4_config.yml
	yq m -i tmp_config.yml tmp_4_config.yml

get-config-gcp-db: config-file = "./manifests/kots-config-gcp-db.yaml"
get-config-gcp-db:
	export BASE64_GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst '$${BASE64_GCP_KEY}' < ${config-file} > tmp_4_config.yml
	envsubst '$${TF_VAR_TEST_ID}' < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

get-config-azure-registry:
	export SERVER=$$(terraform output -json azure_registry | yq r - 'server') && \
	export PASSWORD=$$(terraform output -json azure_registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json azure_registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

get-config-azure-storage:
	export PASSWORD=$$(terraform output -json azure_storage | yq r - 'password') && \
	export USERNAME=$$(terraform output -json azure_storage | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

get-config-azure-db:
	export DBHOST=$$(terraform output -json azure_database | yq r - 'host') && \
	export DBPASS=$$(terraform output -json azure_database | yq r - 'password') && \
	export DBUSER=$$(terraform output -json azure_database | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

get-config-aws-db:
	export DBHOST=$$(terraform output -json aws_database | yq r - 'host') && \
	export DBPASS=$$(terraform output -json aws_database | yq r - 'password') && \
	export DBUSER=$$(terraform output -json aws_database | yq r - 'username') && \
	envsubst < ./manifests/kots-config-aws-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

get-config-aws-storage:
	export REGION=$$(terraform output -json aws_storage | yq r - 'region') && \
	export ENDPOINT=$$(terraform output -json aws_storage | yq r - 'endpoint') && \
	export BUCKET=$$(terraform output -json aws_storage | yq r - 'bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(terraform output -json aws_storage | yq r - 'access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(terraform output -json aws_storage | yq r - 'secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

get-config-aws-registry:
	export SERVER=$$(terraform output -json aws_registry | yq r - 'server' | cut -d / -f 1) && \
	export PASSWORD=$$(terraform output -json aws_registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json aws_registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-aws-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage ?= incluster
registry ?= incluster
db ?= incluster
.PHONY:
## generate-kots-config: Generate the kots config based on test config
generate-kots-config: get-base-config get-config-${storage} get-config-${registry} get-config-${db}

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
	@echo "Curling http://${TF_VAR_TEST_ID}.tests.gitpod-self-hosted.com/api/version"
	curl -i -X GET http://${TF_VAR_TEST_ID}.tests.gitpod-self-hosted.com/api/version || { echo "Curling Gitpod endpoint failed"; exit 1; }

run-tests:
	./tests.sh ${KUBECONFIG}

kots-upgrade:
	@echo "Upgrade gitpod KOTS app to latest"
	kubectl kots upstream upgrade --kubeconfig=${KUBECONFIG} gitpod -n gitpod --deploy

cloud ?= gcp
cleanup: destroy-$(cloud)

select-workspace:
	terraform workspace select $(TF_VAR_TEST_ID)

destroy-gcp: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.clouddns-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.k3s -var kubeconfig=${KUBECONFIG} --auto-approve
	terraform destroy -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-aws: select-workspace
	terraform destroy -target=module.aws-add-dns-record -var kubeconfig=${KUBECONFIG} --auto-approve
	ls ${KUBECONFIG} && terraform destroy -target=module.aws-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.aws-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.eks -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-azure: select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.azure-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.azure-add-dns-record -var kubeconfig=${KUBECONFIG} --auto-approve
	ls ${KUBECONFIG} && terraform destroy -target=module.azure-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	[ -z "$$ARM_SUBSCRIPTION_ID" ] || terraform destroy -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve

get-results:
	@echo "If you have gotten this far, it means your setup succeeded"
	@echo "The IP address of you setup is "$(TF_VAR_TEST_ID).tests.gitpod-self-hosted.com""
	@echo "Following is the KUBECONFIG you can use to connect to the cluster:"
	@cat ${KUBECONFIG}

list-state:
	terraform state list
# end
