.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "$(TOPDIR)/kubeconfig"

cert_secret := ${TF_VAR_TEST_ID}-cert-secret.yaml
github_oauth_secret := ${TF_VAR_TEST_ID}-github-secret.yaml
config_patch := ./manifests/config_patch.yaml

TF_MOD := ../infra/single-cluster/$(cloud)

check-var-%:
	@[[ "${${*}}" ]] || (echo '*** Please define variable `${*}` ***' && exit 1)

.PHONY: help
all: help
help: Makefile
	@echo
	@echo " Choose a command to run in "$(PROJECTNAME)":"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

tf-init: check-var-cloud
	@terraform -chdir=${TF_MOD} init --upgrade

tf-ws: check-var-cloud
	@terraform -chdir=${TF_MOD} workspace new ${TF_VAR_TEST_ID} || terraform -chdir=${TF_MOD} workspace select ${TF_VAR_TEST_ID}

tf-plan: check-var-cloud tf-ws
	$(MAKE) -C ${TF_MOD} plan

tf-apply: check-var-cloud tf-ws
	@echo "Get kubeconfig of existing cluster(if any)..."
	$(MAKE) get-kubeconfig || echo "No pre-existing cluster"
	@echo "Run terraform apply"
	$(MAKE) -C ${TF_MOD} apply-cluster

tf-destroy: check-var-cloud
	[[ -f ${KUBECONFIG} ]] && $(MAKE) -C ${TF_MOD} destroy-tools || echo "**Warning**: Could not cleanup helm resources"
	$(MAKE) -C ${TF_MOD} destroy-cluster

tf-refresh: check-var-cloud
	$(MAKE) -C ${TF_MOD} refresh

tf-output: tf-ws check-var-cloud tf-refresh
	@terraform -chdir=${TF_MOD} output -json > ${TOPDIR}/${TF_VAR_TEST_ID}-output.json
	@echo "Output written to ${TF_VAR_TEST_ID}-output.json"

create-eks-user:
ifeq ($(cloud), aws)
	@export USERARN=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'aws_cluster_user.value.userarn') && \
	export NAME=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'aws_cluster_user.value.name') && \
	envsubst < ./manifests/aws-auth.yaml > tmp-aws-auth.yaml
	@kubectl --kubeconfig=${KUBECONFIG} get configmap -n kube-system aws-auth -o yaml | grep -v "creationTimestamp\|resourceVersion\|selfLink\|uid" | sed '/^  annotations:/,+2 d' > /tmp/aws-auth.yaml
	@yq m --inplace /tmp/aws-auth.yaml tmp-aws-auth.yaml
	@kubectl --kubeconfig=${KUBECONFIG} replace -f /tmp/aws-auth.yaml
else
	@echo "Nothing to do"
endif

upload-creds: tf-output create-eks-user
	@echo "Trying to upload the JSON output to GCS"
	@gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	@gsutil cp $(TF_VAR_TEST_ID)-output.json gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds.json || echo "Could not upload credentials"
	@[[ $(cloud) = k3s ]] && $(MAKE) upload-kubeconfig-to-gcp || echo "Skipping upload of kubeconfig since cluster is not k3s"

upload-kubeconfig-to-gcp:
	@echo "Upload k3s kubeconfig to GCS"
	@gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	@gsutil cp ${KUBECONFIG} gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig

download-creds:
	@echo "Download terraform output from GCS"
	@[[ -z $$self_hosted_jobs ]] || gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	@gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds.json $(TF_VAR_TEST_ID)-output.json || echo "Could not upload credentials"

ami_id_121 := "ami-060637af2651bc8bb"
ami_id_122 := "ami-0733d755ed2c97a4d"
ami_id_123 := "ami-05ec8881b9c2740d4"

# K3S ubuntu image ID
image_id_1804 := "ubuntu-1804-bionic-v20220712"
image_id_2004 := "ubuntu-2004-focal-v20220712"
image_id_2204 := "ubuntu-2204-jammy-v20220712a"

os_version ?= "2004"

.PHONY:
prepare-terraform: ami_id = $(if $(ami_id_${CLUSTER_VERSION//.}),$(ami_id_${CLUSTER_VERSION//.}),$(ami_id_122))
prepare-terraform: ubuntu_image_id = $(if $(image_id_$(os_version)),$(image_id_$(os_version)),$(image_id_2004))
prepare-terraform: check-var-cloud check-var-CLUSTER_VERSION check-var-DOMAIN check-var-GCP_ZONE
	@export KUBECONFIG=${KUBECONFIG} IMAGE_ID=${ami_id} UBUNTU_IMAGE=${ubuntu_image_id} && \
	envsubst < ./manifests/$(cloud)-terraform.tfvars > $(TF_MOD)/terraform.tfvars && \
	cp ./manifests/tf-backend.tf $(TF_MOD)/main.tf  # we set the backend to be gcs based
	@$(MAKE) copy-dns-tf
	@echo "Done setting up tf backend and terraform.tfvars file"


cluster_gcp := gke
cluster_k3s := k3s
cluster_aws := eks
cluster_azure := aks

copy-dns-tf: cluster_mod = $(cluster_$(cloud))
copy-dns-tf:
	@export cluster=$(cluster_mod) && \
	envsubst < ./manifests/managed-dns.tf > $(TF_MOD)/managed-dns.tf
	@echo "Copied managed-dns.tf to create NS record entries"

.PHONY:
standard-cluster: check-var-cloud check-var-TF_VAR_TEST_ID prepare-terraform tf-init
	$(MAKE) get-kubeconfig
	[[ -f ${KUBECONFIG} ]] || { echo "No pre-existing clusters, creating..."; $(MAKE) tf-apply; }

.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record: check-var-cloud prepare-terraform tf-init tf-ws
	@terraform -chdir=$(TF_MOD) apply -target=module.add-dns-record --auto-approve
	@echo "Done adding NS record"

.PHONY:
## cert-manager: Installs cert-manager, optionally create secret for cloud-dns access
cert-manager: check-var-cloud prepare-terraform tf-init tf-ws
	@terraform -chdir=$(TF_MOD) apply -target=module.certmanager --auto-approve
	@echo "Done installing cert-manager"

.PHONY:
## external-dns: Installs external-dns
external-dns: check-var-cloud prepare-terraform tf-init tf-ws
	@terraform -chdir=$(TF_MOD) apply -target=module.externaldns --auto-approve
	@echo "Done creating externaldns for $(cloud)"

self_signed ?= false
.PHONY:
## cluster-issuer: Creates a cluster issuer for the correspondign provider
cluster-issuer: check-var-cloud tf-init tf-ws
ifeq (true,$(self_signed))
	@echo "Skipped creating cluster issuer"
else
	$(MAKE) -C $(TF_MOD) install-cluster-issuer
	@echo "Done creating cluster issuer"
endif


## TODO: (nvn) cleanup all the `get-kubeconfig` targets
.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	@echo "Getting kubeconfig for $$TF_VAR_TEST_ID terraform state" && \
    export provider=$$(echo "$$TF_VAR_TEST_ID" | sed 's/\(.*\)-/\1 /' | xargs | awk '{print $$2}') && \
	$(MAKE) $$provider-kubeconfig && echo "kubeconfig written to ${KUBECONFIG}"

sync-kubeconfig:
	[[ -z $$self_hosted_jobs ]] || gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gcloud config set project sh-automated-tests
	gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig ${KUBECONFIG} || echo "No kubeconfig"

## k3s-kubeconfig: Get the kubeconfig configuration for GCP K3s
k3s-kubeconfig: sync-kubeconfig

## gcp-kubeconfig: Get the kubeconfig configuration for GCP GKE
gcp-kubeconfig:
	@echo "Getting GKE kubeconfig"
	@[[ -n $$self_hosted_jobs ]] || $(MAKE) download-creds
	@[[ -n $$self_hosted_jobs ]] || cat $(TF_VAR_TEST_ID)-output.json | yq r - 'gke_user_key.value' | base64 -d > ${TF_VAR_TEST_ID}-key.json
	@[[ -f ${TF_VAR_TEST_ID}-key.json ]] || cat ${GOOGLE_APPLICATION_CREDENTIALS} > ${TF_VAR_TEST_ID}-key.json
	@gcloud auth activate-service-account --key-file=${TF_VAR_TEST_ID}-key.json --project=sh-automated-tests || { echo "Count not authenicate the service account"; exit 1; }
	@export KUBECONFIG=${KUBECONFIG} && \
	gcloud container clusters get-credentials gp-${TF_VAR_TEST_ID} --zone europe-west1-d --project sh-automated-tests || echo "No cluster present"
	@rm -f ${TF_VAR_TEST_ID}-key.json
	@echo "Kubeconfig written to ${KUBECONFIG}"

## azure-kubeconfig: Get the kubeconfig configuration for Azure AKS
azure-kubeconfig:
	@echo "Getting GKE kubeconfig"
	@[[ -z "$$self_hosted_jobs" ]] || az login --service-principal -u $$ARM_CLIENT_ID -p $$ARM_CLIENT_SECRET  --tenant $$ARM_TENANT_ID
	@export KUBECONFIG=${KUBECONFIG} && \
	az aks get-credentials --name gp-$$TF_VAR_TEST_ID-cluster --resource-group gp-$$TF_VAR_TEST_ID --file ${KUBECONFIG} || echo "No cluster present"

get-aws-secret:
	@echo "Getting AWS terraform output"
	@[[ -z $$self_hosted_jobs ]] || gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	@gcloud config set project sh-automated-tests
	@gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds.json ${TF_VAR_TEST_ID}-output.json
	@echo "export AWS_SECRET_ACCESS_KEY=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'aws_cluster_user.value.secret_access_key')" > ${TF_VAR_TEST_ID}-creds
	@echo "export AWS_ACCESS_KEY_ID=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'aws_cluster_user.value.access_key_id')" >>  ${TF_VAR_TEST_ID}-creds
	@echo -e "\033[0;33mAWS service account credentials fetched, run 'source $$(pwd)/$${TF_VAR_TEST_ID}-creds' to load them into your environment\033[0;m"

## aws-kubeconfig: Get the kubeconfig configuration for AWS EKS
aws-kubeconfig:
	@echo "Getting kubeconfig"
	@[[ -n $$self_hosted_jobs ]] || $(MAKE) get-aws-secret
	@[[ -f ${TF_VAR_TEST_ID}-creds ]] || touch ${TF_VAR_TEST_ID}-creds
	@source ${TF_VAR_TEST_ID}-creds; \
	aws eks update-kubeconfig --name gp-${TF_VAR_TEST_ID} --region eu-west-1 --kubeconfig ${KUBECONFIG} || echo "No cluster present"
	@echo -e "\033[0;33mAWS service account credentials fetched, run 'source $$(pwd)/$${TF_VAR_TEST_ID}-creds' to load them into your environment\033[0;m"

get-github-config: check-var-DOMAIN check-var-TF_VAR_TEST_ID
ifneq ($(GITHUB_SCM_OAUTH),)
	@export SCM_OAUTH=./manifests/github-oauth.yaml && \
	cat $$GITHUB_SCM_OAUTH > $$SCM_OAUTH && \
	yq w -i $$SCM_OAUTH 'oauth.callBackUrl' https://scm.${DOMAIN}/auth/github.com/callback?state=${TF_VAR_TEST_ID} && \
	kubectl --kubeconfig=${KUBECONFIG} create secret generic "github-oauth" \
		--from-literal=provider="$$(cat $$SCM_OAUTH)" \
		-o yaml --dry-run=client > ${github_oauth_secret}
	echo -en  "authProviders:\n  - kind: secret\n    name: github-oauth\n" | base64 -w 0 > ${config_patch}
else
	@echo "Skipping github setup since var GITHUB_SCM_OAUTH is not set"
endif


KOTS_KONFIG := "./manifests/kots-config.yaml"

get-base-config:
	@echo "Creating base configuration"
	@export CONFIG_PATCH=./manifests/config-patch.yaml && \
	export PATCH=$$(cat ${config_patch}) || export PATCH="" && \
	envsubst < ${KOTS_KONFIG} > tmp_config.yml

storage-config-k3s:
	@export k3s_storage_credentials=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.service_account_key_path') && \
	[[ $$k3s_storage_credentials = /* ]] || export k3s_storage_credentials=$$(realpath $(TF_MOD)/$$k3s_storage_credentials) && \
	export BASE64_GCP_KEY=$$(cat $$k3s_storage_credentials | tr -d '\n' | base64 -w 0) && \
	envsubst < ./manifests/kots-config-gcp-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-k3s:
	@export k3s_registry_credentials=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.password_file_path') && \
	[[ $$k3s_registry_credentials = /* ]] || export k3s_registry_credentials=$$(realpath $(TF_MOD)/$$k3s_registry_credentials) && \
	export GCP_KEY=$$(cat $$k3s_registry_credentials | tr -d '\n' | jq -Rsa .) && \
	envsubst < ./manifests/kots-config-gcp-registry.yaml > tmp_4_config.yml
	yq m -i tmp_config.yml tmp_4_config.yml

db-config-k3s:
	@export k3s_db_credentials=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.service_account_key_path') && \
	[[ $$k3s_db_credentials = /* ]] || export k3s_db_credentials=$$(realpath $(TF_MOD)/$$k3s_db_credentials) && \
	export BASE64_GCP_KEY=$$(cat $$k3s_db_credentials | tr -d '\n' | base64 -w 0) && \
	export DB_INSTANCE=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.instance') && \
	export DB_PASSWORD=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.password') && \
	export DB_USER=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-gcp-db.yaml > tmp_4_config.yml
	envsubst < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

storage-config-gcp:
	@echo "Creating GCP storage configuration"
	@export BASE64_GCP_KEY=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.service_account_key' | tr -d '\n' | base64 -w 0) && \
	envsubst < ./manifests/kots-config-gcp-storage.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

registry-config-gcp:
	@echo "Creating GCP registry configuration"
	@export GCP_KEY=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.password' | tr -d '\n' | jq -Rsa .) && \
	envsubst < ./manifests/kots-config-gcp-registry.yaml > tmp_4_config.yml
	@yq m -i tmp_config.yml tmp_4_config.yml

db-config-gcp:
	@echo "Creating GCP database configuration"
	@export BASE64_GCP_KEY=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.service_account_key' | tr -d '\n' | base64 -w 0) && \
	export DB_INSTANCE=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.instance') && \
	export DB_PASSWORD=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.password') && \
	export DB_USER=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-gcp-db.yaml > tmp_4_config.yml
	@envsubst < tmp_4_config.yml > tmp_5_config.yml

registry-config-azure:
	@echo "Creating Azure registry configuration"
	@export SERVER=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.server') && \
	export URL=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.url') && \
	export PASSWORD=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.password') && \
	export USERNAME=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.username') && \
	envsubst < ./manifests/kots-config-azure-registry.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

storage-config-azure:
	@echo "Creating Azure storage configuration"
	@export USERNAME=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.account_name') && \
	export PASSWORD=$$(cat ${TF_VAR_TEST_ID}-output.json| yq r - 'storage.value.account_key') && \
	export REGION=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.storage_region') && \
	envsubst < ./manifests/kots-config-azure-storage.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

db-config-azure:
	@echo "Creating Azure database configuration"
	@export DBHOST=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.host') && \
	export DBPASS=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.password') && \
	export DBUSER=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-azure-db.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

db-config-aws:
	@echo "Creating AWS database configuration"
	@export DBHOST=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'database.value.host') && \
	export DBPASS=$$(cat ${TF_VAR_TEST_ID}-output.json  | yq r - 'database.value.password') && \
	export DBUSER=$$(cat ${TF_VAR_TEST_ID}-output.json  | yq r - 'database.value.username') && \
	envsubst < ./manifests/kots-config-aws-db.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

storage-config-aws:
	@echo "Creating AWS storage configuration"
	@export REGION=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.region') && \
	export ENDPOINT=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.endpoint') && \
	export BUCKET=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-storage.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

s3-registry-backend-config-aws: # this registry config involves using s3 backend for incluster registry
	@echo "Creating AWS registry backend configuration"
	@export REGION=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.region') && \
	export ENDPOINT=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.endpoint') && \
	export BUCKET=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'storage.value.secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-s3-backend.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

registry-config-aws:
	@echo "External registry is not supported yet for AWS"

# @echo "Creating AWS registry configuration"
# @export SERVER=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.server' | cut -d / -f 1) && \
# export PASSWORD=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.password') && \
# export USERNAME=$$(cat ${TF_VAR_TEST_ID}-output.json | yq r - 'registry.value.username') && \
# envsubst < ./manifests/kots-config-aws-registry.yaml > tmp_2_config.yml
# @yq m -i tmp_config.yml tmp_2_config.yml

self-signed-config:
	# install in local store
	@echo "Creating self-signed certificate"
	@mkcert -install

	@cat "${HOME}"/.local/share/mkcert/rootCA.pem > ./ca.pem
	@mkcert -cert-file "./ssl.crt" \
	  -key-file "./ssl.key" \
	  "*.ws.${TF_VAR_TEST_ID}.${DOMAIN}" "*.${TF_VAR_TEST_ID}.${DOMAIN}" "${TF_VAR_TEST_ID}.${DOMAIN}"

	@export CA_CERT=$$(cat ./ca.pem | base64 -w 0) && \
	export SSL_CERT=$$(cat ./ssl.crt | base64 -w 0) && \
	export SSL_KEY=$$(cat ./ssl.key | base64 -w 0) && \
	envsubst < ./manifests/kots-config-self-signed.yaml > tmp_2_config.yml
	@yq m -i tmp_config.yml tmp_2_config.yml

	# upload the Custom CA Cert into tf-state
	@gsutil cp ./ca.pem gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-ca.pem

storage-config-incluster:
	@echo "Nothing to do"

db-config-incluster:
	@echo "Nothing to do"

registry-config-incluster:
ifeq ($(cloud), aws)
	@$(MAKE) s3-registry-backend-config-aws
else
	@echo "Nothing to do"
endif

storage ?= incluster
registry ?= incluster
db ?= incluster
skipTests ?= "false"
self_signed ?= "false"
.PHONY:
generate-kots-config: cloud_storage = $(if $(findstring external,$(storage)),$(cloud),incluster)
generate-kots-config: cloud_registry = $(if $(findstring external,$(registry)),$(cloud),incluster)
generate-kots-config: cloud_db = $(if $(findstring external,$(db)),$(cloud),incluster)
## generate-kots-config: Generate the kots config based on test config
generate-kots-config: tf-init tf-output check-var-cloud check-var-DOMAIN check-var-TF_VAR_TEST_ID
	@if [[ $$skipTests == "false" ]]; then $(MAKE) get-github-config; fi
	$(MAKE) get-base-config
	$(MAKE) storage-config-${cloud_storage}
	$(MAKE) db-config-${cloud_db}
	$(MAKE) registry-config-${cloud_registry}
	@if [[ $$self_signed == "true" ]]; then $(MAKE) self-signed-config; fi
	@echo -e "\033[0;33mGitpod config is created in 'tmp_config.yml'\033[0;m"

download-certs:
	@echo "Trying to download pre-existing secrets for certificate from GCS"
	@gsutil cp gs://nightly-tests/nightly-tests-certs/${cert_secret} ${cert_secret} || { echo "No certificate found"; rm -f ${cert_secret}; }

create-secrets: download-certs
	@echo ${github_oauth_secret}
	@echo "Creating secrets for SSL certificate and Github oauth"
	@kubectl --kubeconfig=${KUBECONFIG} create ns gitpod || echo "Namespace already exists"
	@[[ -f ${cert_secret} ]] && kubectl --kubeconfig=${KUBECONFIG} apply -f ${cert_secret} -n gitpod || echo "Skipping certificate restore"
	@[[ -f ${github_oauth_secret} ]] && kubectl --kubeconfig=${KUBECONFIG} apply -f ${github_oauth_secret} -n gitpod || echo "Skipping Github oauth setup"

license_community_beta := "../licenses/Community (Beta).yaml"
license_community_stable := "../licenses/Community.yaml"
license_community_unstable := "../licenses/Community (Unstable).yaml"

preflights ?= true
channel ?= unstable
app ?= gitpod
version ?= -
kots-install: version-flag = $(if $(version:-=),--app-version-label=$(version),)
kots-install: preflight-flag = $(if $(preflights:true=),--skip-preflights,)
kots-install: license-file = $(if $(license_community_$(channel)),$(license_community_$(channel)),"../licenses/$(channel).yaml")
kots-install: destroy-gitpod create-secrets
	kubectl kots install ${app}/${channel} \
	--skip-rbac-check ${version-flag} ${preflight-flag} \
					--wait-duration "10m" \
					--namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${license-file} \
                    --no-port-forward \
                    --config-values tmp_config.yml

time_to_sleep_azure := 800 # azure seem to take more time to fullfil DNS propogation
time_to_sleep := 500

wait_time := 180
wait_time_azure := 300

delete-cm-setup: sleeptime=$(if $(time_to_sleep_$(cloud)),$(time_to_sleep_$(cloud)),${time_to_sleep})
delete-cm-setup: waittime=$(if $(wait_time_$(cloud)),$(wait_time_$(cloud)),${wait_time})
delete-cm-setup:
	@echo "restarting cert-manager"
	@sleep ${waittime} && kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager && sleep ${sleeptime};

gitpod-debug-info:
	@echo -e "\033[;31mGitpod is not ready\033[0;m"
	@kubectl --kubeconfig=${KUBECONFIG} get pods -n gitpod
	@kubectl --kubeconfig=${KUBECONFIG} get certificate -n gitpod
	@echo "Uploading diagnostics to gs://nightly-tests/nightly-tests-errors/${TF_VAR_TEST_ID}"

	kubectl kots --kubeconfig=${KUBECONFIG} --namespace gitpod get app gitpod

	kubectl --kubeconfig=${KUBECONFIG} --namespace gitpod get pod -ojson > pods.json \
	&& gsutil cp pods.json gs://nightly-tests/nightly-tests-errors/${TF_VAR_TEST_ID}/pods.json

	kubectl --kubeconfig=${KUBECONFIG} --namespace gitpod get event --sort-by '.metadata.creationTimestamp' > events.log \
	&& gsutil cp events.log gs://nightly-tests/nightly-tests-errors/${TF_VAR_TEST_ID}/events.log

	kubectl --kubeconfig=${KUBECONFIG} --namespace gitpod describe certificate https-certificates > cert.log \
	&& gsutil cp cert.log gs://nightly-tests/nightly-tests-errors/${TF_VAR_TEST_ID}/cert.log


check-kots-app:
	@echo "Check if Gitpod kots app is ready"
	@kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $$2}' | grep "ready" || { $(MAKE) gitpod-debug-info; exit 1; }

self_signed ?= false

check-gitpod-installation: delete-cm-setup check-kots-app check-var-TF_VAR_TEST_ID
	@echo "Curling https://${TF_VAR_TEST_ID}.${DOMAIN}/api/version"
ifeq (true,$(self_signed))
	export SSL_CERT_FILE=./ca.pem
endif
	@curl -i -X GET https://${TF_VAR_TEST_ID}.${DOMAIN}/api/version || { echo "**Error**: Curling Gitpod endpoint failed"; exit 1; }

define runtests
	./tests.sh ${KUBECONFIG} $(1)
endef

run-workspace-tests:
	$(call runtests,"test/tests/workspace/")

run-vscode-ide-tests:
	$(call runtests,"test/tests/ide/vscode/")

run-jb-ide-tests:
	$(call runtests,"test/tests/ide/jetbrains/")

run-ssh-tests:
	$(call runtests,"test/tests/ide/ssh/")

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
	@kubectl kots upstream upgrade --kubeconfig=${KUBECONFIG} gitpod -n gitpod --deploy

cleanup: get-kubeconfig destroy-gitpod prepare-terraform tf-init tf-ws tf-destroy destroy-workspace destroy-kubeconfig

destroy-kubeconfig:
	@gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	@gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig || echo "No kubeconfig"
	@gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds || echo "No credentials file"
	@gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds.json || echo "No credentials file"
	@gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-ca.pem || echo "No custom CA cert file"
	@rm ${KUBECONFIG} || echo "No kubeconfig"

destroy-workspace:
	@echo "Destroying the workspace $$TF_VAR_TEST_ID"
	@terraform -chdir=${TF_MOD} workspace select default
	@terraform -chdir=${TF_MOD} workspace delete $(TF_VAR_TEST_ID) || { echo "**Error**: Couldn't delete workspace, please cleanup manually"; $(MAKE) list-state; }

# Delete the Gitpod namespace and all associated resources.
#
# The sleep following deletion adds a bit of padding so that external resources (such
# as AWS ELBs generated from LoadBalancer type services) can terminate.
destroy-gitpod: backup-cert
	[[ -f ${KUBECONFIG} ]] \
		&& kubectl --kubeconfig=${KUBECONFIG} delete namespace/gitpod --now --timeout 180s \
		|| true

backup-cert:
	@echo "Backing up certificate secret to GCS"
	@kubectl --kubeconfig=${KUBECONFIG} get secret -n gitpod https-certificates -o yaml > ${cert_secret} || { echo "No existing secret"; rm -f ${cert_secret}; }
	@[[ -f ${cert_secret} ]] && gsutil cp ${cert_secret} gs://nightly-tests/nightly-tests-certs/${cert_secret} || echo "No certificate secret file exist"

list-state: tf-ws
	@terraform -chdir=${TF_MOD} state list

cleanup-old-tests:
	./cleanup.sh

# end
