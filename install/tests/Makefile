.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "$(TOPDIR)/kubeconfig"

DOMAIN := sh-tests.gitpod-self-hosted.com

TF_MOD := ../infra/single-cluster/$(cloud)

check-env-sub-domain:
ifndef TF_VAR_TEST_ID
	$(error TF_VAR_TEST_ID is not defined)
endif

check-env-cloud:
ifndef cloud
	$(error cloud is not defined)
endif

check-env-cluster-version:
ifndef TF_VAR_cluster_version
	$(error TF_VAR_cluster_version is not defined)
endif

.PHONY: help
all: help
help: Makefile
	@echo
	@echo " Choose a command to run in "$(PROJECTNAME)":"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

upload-kubeconfig-to-gcp:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil cp ${KUBECONFIG} gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig

sync-kubeconfig:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig ${KUBECONFIG} || echo "No kubeconfig"

## k3s-kubeconfig: Get the kubeconfig configuration for GCP K3s
k3s-kubeconfig: sync-kubeconfig

## gcp-kubeconfig: Get the kubeconfig configuration for GCP GKE
gcp-kubeconfig:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	export KUBECONFIG=${KUBECONFIG} && \
	gcloud container clusters get-credentials gp-${TF_VAR_TEST_ID} --zone europe-west1-d --project sh-automated-tests || $(MAKE) sync-kubeconfig || echo "No cluster present"

## azure-kubeconfig: Get the kubeconfig configuration for Azure AKS
azure-kubeconfig:
	export KUBECONFIG=${KUBECONFIG} && \
	az aks get-credentials --name gp-$$TF_VAR_TEST_ID-cluster --resource-group gp-$$TF_VAR_TEST_ID --file ${KUBECONFIG} || echo "No cluster present"

## aws-kubeconfig: Get the kubeconfig configuration for AWS EKS
aws-kubeconfig:
	export KUBECONFIG=${KUBECONFIG} && \
	aws eks update-kubeconfig --name gp-${TF_VAR_TEST_ID} --region eu-west-1 --kubeconfig ${KUBECONFIG} || echo "No cluster present"


# AWS AMI ID for each kubernetes version for eu-west-1 region
ami_id_121 := "ami-060637af2651bc8bb"
ami_id_122 := "ami-0733d755ed2c97a4d"
ami_id_123 := "ami-05ec8881b9c2740d4"

# K3S ubuntu image ID
image_id_1804 := "ubuntu-1804-bionic-v20220712"
image_id_2004 := "ubuntu-2004-focal-v20220712"
image_id_2204 := "ubuntu-2204-jammy-v20220712a"

os_version ?= "2004"
prepare-terraform: ami_id = $(if $(ami_id_${TF_VAR_cluster_version//.}),$(ami_id_${TF_VAR_cluster_version//.}),$(ami_id_122))
prepare-terraform: ubuntu_image_id = $(if $(image_id_$(os_version)),$(image_id_$(os_version)),$(image_id_2004))
prepare-terraform:
	export DOMAIN=${DOMAIN} && \
	export CLUSTER_VERSION=$$TF_VAR_cluster_version && \
	export KUBECONFIG=${KUBECONFIG} IMAGE_ID=${ami_id} UBUNTU_IMAGE=${ubuntu_image_id} && \
	envsubst < ./manifests/$(cloud)-terraform.tfvars > $(TF_MOD)/terraform.tfvars
	cp ./manifests/tf-backend.tf $(TF_MOD)/main.tf  # we set the backend to be gcs based

.PHONY:
## standard-cluster: Creates a kubernetes cluster of type $cloud
standard-cluster: check-env-cloud check-env-cluster-version prepare-terraform
	$(MAKE) -C $(TF_MOD) init
	$(MAKE) select-workspace WORKDIR=$(TF_MOD)
	$(MAKE) -C $(TF_MOD) apply-cluster
	@echo "Done creating $(cloud) cluster"

.PHONY:
## cert-manager: Installs cert-manager, optionally create secret for cloud-dns access
cert-manager: check-env-cloud
	$(MAKE) -C $(TF_MOD) init
	$(MAKE) select-workspace WORKDIR=$(TF_MOD)
	terraform -chdir=$(TF_MOD) apply -target=module.certmanager --auto-approve
	@echo "Done installing cert-manager"

.PHONY:
## external-dns: Installs external-dns
external-dns: check-env-cloud
	$(MAKE) -C $(TF_MOD) init
	$(MAKE) select-workspace WORKDIR=$(TF_MOD)
	terraform -chdir=$(TF_MOD) apply -target=module.externaldns --auto-approve
	@echo "Done creating externaldns for $(cloud)"

.PHONY:
## cluster-issuer: Creates a cluster issuer for the correspondign provider
cluster-issuer: check-env-cloud
	$(MAKE) -C $(TF_MOD) init
	$(MAKE) select-workspace WORKDIR=$(TF_MOD)
	$(MAKE) -C $(TF_MOD) install-cluster-issuer
	@echo "Done creating cluster issuer"

.PHONY:
terraform-output: prepare-terraform
	terraform -chdir=$(TF_MOD) refresh
	terraform -chdir=$(TF_MOD) output -json > $(cloud)-output.json

cluster_gcp := gke
cluster_k3s := k3s
cluster_aws := eks
cluster_azure := aks

.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record: cluster_mod = $(cluster_$(cloud))
add-ns-record: check-env-cloud prepare-terraform
	export cluster=$(cluster_mod) && \
	envsubst < ./manifests/gcp-dns.tf > $(TF_MOD)/gcp-dns.tf
	$(MAKE) -C $(TF_MOD) init
	$(MAKE) select-workspace WORKDIR=$(TF_MOD)
	terraform -chdir=$(TF_MOD) apply -target=module.add-dns-record --auto-approve
	@echo "Done adding NS record"

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig: ${cloud}-kubeconfig


get-github-config:
ifneq ($(GITHUB_SCM_OAUTH),)
	export SCM_OAUTH=./manifests/github-oauth.yaml && \
	cat $$GITHUB_SCM_OAUTH/provider > $$SCM_OAUTH && \
	yq w -i $$SCM_OAUTH 'oauth.callBackUrl' http://${TF_VAR_TEST_ID}.${DOMAIN}/auth/github.com/callback && \
	kubectl --kubeconfig=${KUBECONFIG} create namespace gitpod || echo "Gitpod namespace already exist" && \
	kubectl --kubeconfig=${KUBECONFIG} delete secret github-oauth -n gitpod || echo "gitpod-oauth secret needs to be created" && \
	kubectl --kubeconfig=${KUBECONFIG} create secret generic "github-oauth" --namespace gitpod --from-literal=provider="$$(cat $$SCM_OAUTH)" && \
	echo -en  "authProviders:\n  - kind: secret\n    name: github-oauth\n" > ./manifests/config-patch.yaml
else
	echo "Skipping github setup since var GITHUB_SCM_OAUTH is not set"
endif

KOTS_KONFIG := "./manifests/kots-config.yaml"

get-base-config: get-github-config
	export CONFIG_PATCH=./manifests/config-patch.yaml && \
	export DOMAIN=${DOMAIN} && \
	export PATCH=$$(cat $$CONFIG_PATCH | base64 -w 0) || export PATCH="" && \
	envsubst < ${KOTS_KONFIG} > tmp_config.yml

storage-config-gcp:
	export gcp_storage_credentials=$$(cat gcp-output.json | yq r - 'storage.value.service_account_key_path') && \
	[[ $$gcp_storage_credentials = /* ]] || export gcp_storage_credentials=$$(realpath $(TF_MOD)/$$gcp_storage_credentials)
	export BASE64_GCP_KEY=$$(cat $$gcp_storage_credentials | tr -d '\n' | base64 -w 0) && \
	envsubst < ./manifests/kots-config-gcp-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-gcp:
	export gcp_registry_credentials=$$(cat gcp-output.json | yq r - 'registry.value.password') && \
	export GCP_KEY=$$(echo $$gcp_registry_credentials | tr -d '\n' ) && \
	envsubst < ./manifests/kots-config-gcp-registry.yaml > tmp_4_config.yml
	yq m -i tmp_config.yml tmp_4_config.yml

db-config-gcp:
	export gcp_db_credentials=$$(cat gcp-output.json | yq r - 'database.value.service_account_key_path') && \
	[[ $$gcp_db_credentials = /* ]] || export gcp_db_credentials=$$(realpath $(TF_MOD)/$$gcp_db_credentials) && \
	export BASE64_GCP_KEY=$$(cat $$gcp_db_credentials | tr -d '\n' | base64 -w 0) && \
	export DB_INSTANCE=$$(cat gcp-output.json | yq r - 'database.value.instance') && \
	export DB_PASSWORD=$$(cat gcp-output.json | yq r - 'database.value.password') && \
	export DB_USER=$$(cat gcp-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-gcp-db.yaml > tmp_4_config.yml
	envsubst < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

storage-config-k3s:
	export k3s_storage_credentials=$$(cat k3s-output.json | yq r - 'storage.value.service_account_key_path') && \
	[[ $$k3s_storage_credentials = /* ]] || export k3s_storage_credentials=$$(realpath $(TF_MOD)/$$k3s_storage_credentials) && \
	export BASE64_GCP_KEY=$$(cat $$k3s_storage_credentials | tr -d '\n' | base64 -w 0) && \
	envsubst < ./manifests/kots-config-gcp-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-k3s:
	export k3s_registry_credentials=$$(cat k3s-output.json | yq r - 'registry.value.password_file_path') && \
	[[ $$k3s_registry_credentials = /* ]] || export k3s_registry_credentials=$$(realpath $(TF_MOD)/$$k3s_registry_credentials) && \
	export GCP_KEY=$$(cat $$k3s_registry_credentials | tr -d '\n' | jq -Rsa .) && \
	envsubst < ./manifests/kots-config-gcp-registry.yaml > tmp_4_config.yml
	yq m -i tmp_config.yml tmp_4_config.yml

db-config-k3s:
	export k3s_db_credentials=$$(cat k3s-output.json | yq r - 'database.value.service_account_key_path') && \
	[[ $$k3s_db_credentials = /* ]] || export k3s_db_credentials=$$(realpath $(TF_MOD)/$$k3s_db_credentials) && \
	export BASE64_GCP_KEY=$$(cat $$k3s_db_credentials | tr -d '\n' | base64 -w 0) && \
	export DB_INSTANCE=$$(cat k3s-output.json | yq r - 'database.value.instance') && \
	export DB_PASSWORD=$$(cat k3s-output.json | yq r - 'database.value.password') && \
	export DB_USER=$$(cat k3s-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-gcp-db.yaml > tmp_4_config.yml
	envsubst < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

registry-config-azure:
	export SERVER=$$(cat azure-output.json | yq r - 'registry.value.server') && \
	export URL=$$(cat azure-output.json | yq r - 'registry.value.url') && \
	export PASSWORD=$$(cat azure-output.json | yq r - 'registry.value.password') && \
	export USERNAME=$$(cat azure-output.json | yq r - 'registry.value.username') && \
	envsubst < ./manifests/kots-config-azure-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage-config-azure:
	export PASSWORD=$$(cat azure-output.json | yq r - 'storage.value.account_name') && \
	export USERNAME=$$(cat azure-output.json | yq r - 'storage.value.account_key') && \
	export REGION=$$(cat azure-output.json | yq r - 'storage.value.storage_region') && \
	envsubst < ./manifests/kots-config-azure-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

db-config-azure:
	export DBHOST=$$(cat azure-output.json | yq r - 'database.value.host') && \
	export DBPASS=$$(cat azure-output.json | yq r - 'database.value.password') && \
	export DBUSER=$$(cat azure-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-azure-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

db-config-aws:
	export DBHOST=$$(cat aws-output.json | yq r - 'database.value.host') && \
	export DBPASS=$$(cat aws-output.json | yq r - 'database.value.password') && \
	export DBUSER=$$(cat aws-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-aws-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage-config-aws:
	export REGION=$$(cat aws-output.json | yq r - 'storage.value.region') && \
	export ENDPOINT=$$(cat aws-output.json | yq r - 'storage.value.endpoint') && \
	export BUCKET=$$(cat aws-output.json | yq r - 'storage.value.bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(cat aws-output.json | yq r - 'storage.value.access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(cat aws-output.json | yq r - 'storage.value.secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

s3-registry-backend-config-aws: # this registry config involves using s3 backend for incluster registry
	export REGION=$$(cat aws-output.json | yq r - 'storage.value.region') && \
	export ENDPOINT=$$(cat aws-output.json | yq r - 'storage.value.endpoint') && \
	export BUCKET=$$(cat aws-output.json | yq r - 'storage.value.bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(cat aws-output.json | yq r - 'storage.value.access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(cat aws-output.json | yq r - 'storage.value.secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-s3-backend.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-aws:
	@echo "we don't support it just yet"


# export SERVER=$$(cat aws-output.json | yq r - 'storage.value.server' | cut -d / -f 1) && \
# export PASSWORD=$$(cat aws-output.json | yq r - 'storage.value.password') && \
# export USERNAME=$$(cat aws-output.json | yq r - 'storage.value.username') && \
# envsubst < ./manifests/kots-config-aws-registry.yaml > tmp_2_config.yml
# yq m -i tmp_config.yml tmp_2_config.yml

storage-config-incluster:
	@echo "Nothing to do"

db-config-incluster:
	@echo "Nothing to do"

registry-config-incluster:
ifeq ($(cloud), aws)
	$(MAKE) s3-registry-backend-config-aws
else
	@echo "Nothing to do"
endif

storage ?= incluster
registry ?= incluster
db ?= incluster
.PHONY:
generate-kots-config: cloud_storage = $(if $(findstring external,$(storage)),$(cloud),incluster)
generate-kots-config: cloud_registry = $(if $(findstring external,$(registry)),$(cloud),incluster)
generate-kots-config: cloud_db = $(if $(findstring external,$(db)),$(cloud),incluster)
## generate-kots-config: Generate the kots config based on test config
generate-kots-config: check-env-cloud terraform-output get-base-config
	$(MAKE) storage-config-${cloud_storage}
	$(MAKE) db-config-${cloud_db}
	$(MAKE) registry-config-${cloud_registry}

license_community_beta := "../licenses/Community (Beta).yaml"
license_community_stable := "../licenses/Community.yaml"
license_community_unstable := "../licenses/Community (Unstable).yaml"

install-kots-cli:
	curl https://kots.io/install | bash

preflights ?= true
channel ?= unstable
app ?= gitpod
version ?= -
kots-install: version-flag = $(if $(version:-=),--app-version-label=$(version),)
kots-install: preflight-flag = $(if $(preflights:true=),--skip-preflights,)
kots-install: license-file = $(if $(license_community_$(channel)),$(license_community_$(channel)),"../licenses/$(channel).yaml")
kots-install: install-kots-cli get-kubeconfig
	kubectl kots remove ${app} -n gitpod --force --kubeconfig=${KUBECONFIG} || echo "No kots app existing, Installing"
	kubectl kots install ${app}/${channel} \
	--skip-rbac-check ${version-flag} ${preflight-flag} \
					--wait-duration "10m" \
					--namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${license-file} \
                    --no-port-forward \
                    --config-values tmp_config.yml

time_to_sleep_azure := 600 # azure seem to take more time to fullfil DNS propogation
time_to_sleep := 300

wait_time := 180
wait_time_azure := 300

delete-cm-setup: sleeptime=$(if $(time_to_sleep_$(cloud)),$(time_to_sleep_$(cloud)),${time_to_sleep})
delete-cm-setup: waittime=$(if $(wait_time_$(cloud)),$(wait_time_$(cloud)),${wait_time})
delete-cm-setup:
	sleep ${waittime} && kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager && sleep ${sleeptime};

gitpod-debug-info:
	@echo "Gitpod is not ready"
	@kubectl --kubeconfig=${KUBECONFIG} get pods -n gitpod
	@kubectl --kubeconfig=${KUBECONFIG} get certificate -n gitpod

check-kots-app:
	kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $$2}' | grep "ready" || { $(MAKE) gitpod-debug-info; exit 1; }

check-gitpod-installation: delete-cm-setup check-kots-app check-env-sub-domain
	@echo "Curling http://${TF_VAR_TEST_ID}.${DOMAIN}/api/version"
	curl -i -X GET http://${TF_VAR_TEST_ID}.${DOMAIN}/api/version || { echo "Curling Gitpod endpoint failed"; exit 1; }

define runtests
	./tests.sh ${KUBECONFIG} $(1)
endef

run-workspace-tests:
	$(call runtests,"test/tests/workspace/")

run-vscode-ide-tests:
	$(call runtests,"test/tests/ide/vscode/")

run-jb-ide-tests:
	$(call runtests,"test/tests/ide/jetbrains/")

run-cs-component-tests:
	$(call runtests,"test/tests/components/content-service/")

run-db-component-tests:
	$(call runtests,"test/tests/components/database/")

run-ib-component-tests:
	$(call runtests,"test/tests/components/image-builder/")

run-server-component-tests:
	$(call runtests,"test/tests/components/server/")

run-wsd-component-tests:
	$(call runtests,"test/tests/components/ws-daemon/")

run-wsm-component-tests:
	$(call runtests,"test/tests/components/ws-manager/")

kots-upgrade:
	@echo "Upgrade gitpod KOTS app to latest"
	kubectl kots upstream upgrade --kubeconfig=${KUBECONFIG} gitpod -n gitpod --deploy

cleanup: check-env-cloud $(cloud)-kubeconfig destroy-gitpod destroy-infra destroy-workspace destroy-kubeconfig

cluster-kubeconfig: azure-kubeconfig aws-kubeconfig k3s-kubeconfig gcp-kubeconfig

tf-init:
	@terraform init

destroy-infra: check-env-cloud
	$(MAKE) -C $(TF_MOD) destroy

destroy-kubeconfig:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig || echo "No kubeconfig"
	rm ${KUBECONFIG} || echo "No kubeconfig"

WORKDIR ?= "."
select-workspace:
	terraform -chdir=${WORKDIR} workspace new $(TF_VAR_TEST_ID) || terraform -chdir=${WORKDIR} workspace select $(TF_VAR_TEST_ID)

destroy-workspace:
	terraform -chdir=${TF_MOD} workspace select default
	terraform -chdir=${TF_MOD} workspace delete $(TF_VAR_TEST_ID) || echo "Couldn't delete workspace, please cleanup manually"

destroy-infrastructure:

# Delete the Gitpod namespace and all associated resources.
#
# The sleep following deletion adds a bit of padding so that external resources (such
# as AWS ELBs generated from LoadBalancer type services) can terminate.
destroy-gitpod:
	[[ -f ${KUBECONFIG} ]] \
		&& kubectl --kubeconfig=${KUBECONFIG} delete namespace/gitpod --now --timeout 180s \
		|| true

list-state:
	terraform state list

cleanup-old-tests:
	./cleanup.sh

# end
