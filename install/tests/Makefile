.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "$(TOPDIR)/kubeconfig"

cert_secret := ${TF_VAR_TEST_ID}-cert-secret.yaml
github_oauth_secret := ${TF_VAR_TEST_ID}-github-secret.yaml
config_patch := ./manifests/config_patch.yaml

check-env-sub-domain:
ifndef TF_VAR_TEST_ID
	$(error TF_VAR_TEST_ID is not defined)
endif

check-env-domain:
ifndef TF_VAR_domain
	$(error TF_VAR_domain is not defined)
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

upload-gcp-cluster-creds:
	export GKE_CREDS=$$(terraform output -json gke_user_key) && \
	echo $$GKE_CREDS > gcp-creds
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil cp gcp-creds gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds

download-cluster-creds:
	[[ -z $$self_hosted_jobs ]] || gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gcloud config set project sh-automated-tests
	[[ -n $$self_hosted_jobs ]] || gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds gcs-creds
	[[ -f gcs-creds ]]  && cat gcs-creds | tr -d '"' | base64 -d > ${TF_VAR_TEST_ID}-key.json || echo "No GCP credentials"
	rm -f gcs-creds
	[[ -f ${TF_VAR_TEST_ID}-key.json ]] || cp ${GOOGLE_APPLICATION_CREDENTIALS} ${TF_VAR_TEST_ID}-key.json

upload-kubeconfig-to-gcp:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil cp ${KUBECONFIG} gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig

sync-kubeconfig:
	[[ -z $$self_hosted_jobs ]] || gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gcloud config set project sh-automated-tests
	gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig ${KUBECONFIG} || echo "No kubeconfig"

## k3s-kubeconfig: Get the kubeconfig configuration for GCP K3s
k3s-kubeconfig: sync-kubeconfig

## gcp-kubeconfig: Get the kubeconfig configuration for GCP GKE
gcp-kubeconfig:
	$(MAKE) download-cluster-creds
	gcloud auth activate-service-account --key-file=${TF_VAR_TEST_ID}-key.json --project=sh-automated-tests || { echo "Count not authenicate the service account"; exit 1; }
	export KUBECONFIG=${KUBECONFIG} && \
	gcloud container clusters get-credentials gp-${TF_VAR_TEST_ID} --zone europe-west1-d --project sh-automated-tests || echo "No cluster present"
	rm -f ${TF_VAR_TEST_ID}-key.json

## azure-kubeconfig: Get the kubeconfig configuration for Azure AKS
azure-kubeconfig:
	[[ -z "$$self_hosted_jobs" ]] || az login --service-principal -u $$ARM_CLIENT_ID -p $$ARM_CLIENT_SECRET  --tenant $$ARM_TENANT_ID
	export KUBECONFIG=${KUBECONFIG} && \
	az aks get-credentials --name p$$TF_VAR_TEST_ID-cluster --resource-group p$$TF_VAR_TEST_ID --file ${KUBECONFIG} || echo "No cluster present"

## aws-kubeconfig: Get the kubeconfig configuration for AWS EKS
aws-kubeconfig:
	[[ -z $$self_hosted_jobs ]] || gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gcloud config set project sh-automated-tests
	[[ -n $$self_hosted_jobs ]] || gsutil cp gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds ${TF_VAR_TEST_ID}-creds
	[[ -f ${TF_VAR_TEST_ID}-creds ]] || touch ${TF_VAR_TEST_ID}-creds
	source ${TF_VAR_TEST_ID}-creds; \
	aws eks update-kubeconfig --name ${TF_VAR_TEST_ID} --region eu-west-1 --kubeconfig ${KUBECONFIG} || echo "No cluster present"
	@echo -e "\033[0;33mAWS service account credentials fetched, run 'source $$(pwd)/$${TF_VAR_TEST_ID}-creds' to load them into your environment\033[0;m"

.PHONY:
## gke-standard-cluster: Creates a zonal GKE cluster
gke-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	rm -f ${KUBECONFIG} && \
	$(MAKE) get-kubeconfig && \
	[[ -f ${KUBECONFIG} ]] || terraform apply -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve
	$(MAKE) upload-gcp-cluster-creds
	@echo "Done creating GKE cluster"

upload-eks-user:
	export AWS_CLUSTER_USER=$$(terraform output -json aws_cluster_user) && \
	export USERARN=$$(echo $$AWS_CLUSTER_USER | yq r - 'userarn') && \
	export NAME=$$(echo $$AWS_CLUSTER_USER | yq r - 'name') && \
	envsubst < ./manifests/aws-auth.yaml > tmp-aws-auth.yaml && \
	echo "export AWS_SECRET_ACCESS_KEY=$$(echo $$AWS_CLUSTER_USER | yq r - 'secret_access_key')" > ${TF_VAR_TEST_ID}-creds && \
	echo "export AWS_ACCESS_KEY_ID=$$(echo $$AWS_CLUSTER_USER | yq r - 'access_key_id')" >> ${TF_VAR_TEST_ID}-creds && \
	kubectl --kubeconfig=${KUBECONFIG} get configmap -n kube-system aws-auth -o yaml | grep -v "creationTimestamp\|resourceVersion\|selfLink\|uid" | sed '/^  annotations:/,+2 d' > /tmp/aws-auth.yaml
	yq m --inplace /tmp/aws-auth.yaml tmp-aws-auth.yaml
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil cp ${TF_VAR_TEST_ID}-creds gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds
	kubectl --kubeconfig=${KUBECONFIG} replace -f /tmp/aws-auth.yaml

ami_id_121 := "ami-060637af2651bc8bb"

ami_id_122 := "ami-0733d755ed2c97a4d"

ami_id_123 := "ami-05ec8881b9c2740d4"

.PHONY:
## eks-standard-cluster: Creates an EKS cluster
eks-standard-cluster: ami_id = $(if $(ami_id_${TF_VAR_cluster_version//.}),$(ami_id_${TF_VAR_cluster_version//.}),$(ami_id_122))
eks-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	rm -f ${KUBECONFIG} && \
	$(MAKE) get-kubeconfig && \
	[[ -f ${KUBECONFIG} ]] || terraform apply -target=module.eks -var kubeconfig=${KUBECONFIG} -var eks_node_image_id=${ami_id} --auto-approve
	$(MAKE) upload-eks-user
	@echo "Done creating EKS cluster"

.PHONY:
## aks-standard-cluster: Creates an AKS cluster
aks-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	rm -f ${KUBECONFIG} && \
	$(MAKE) get-kubeconfig && \
	[[ -f ${KUBECONFIG} ]] || terraform apply -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating AKS cluster"

.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record: check-env-cloud
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-add-dns-record  -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done adding NS record"

self_signed ?= false
.PHONY:
## cluster-issuer: Creates a cluster issuer for the correspondign provider
cluster-issuer: check-env-cloud
ifeq (true,$(self_signed))
	@echo "Skipped creating cluster issuer"
else
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-issuer  -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating cluster issuer"
endif

image_id_1804 := "ubuntu-1804-bionic-v20220712"

image_id_2004 := "ubuntu-2004-focal-v20220712"

image_id_2204 := "ubuntu-2204-jammy-v20220712a"

os_version ?= "2004"
.PHONY:
## k3s-standard-cluster: Creates a K3S cluster on GCP with one master and 1 worker node
k3s-standard-cluster: image_id = $(if $(image_id_$(os_version)),$(image_id_$(os_version)),$(image_id_2004))
k3s-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	rm -f ${KUBECONFIG} && \
	$(MAKE) get-kubeconfig && \
	[[ -f ${KUBECONFIG} ]] || terraform apply -target=module.k3s -var kubeconfig=${KUBECONFIG} -var k3s_node_image_id=${image_id} --auto-approve && \
	terraform apply -target=module.k3s-add-dns-record  -var kubeconfig=${KUBECONFIG} --auto-approve
	$(MAKE) upload-kubeconfig-to-gcp # we upload the file to GCP since we cannot retrieve the file against without SSHing to the master
	@echo "Done creating k3s cluster"

.PHONY:
## cert-manager: Installs cert-manager, optionally create secret for cloud-dns access
cert-manager:
	$(MAKE) select-workspace && \
	terraform apply -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done installing cert-manager"

.PHONY:
## managed-dns: Installs external-dns, and setup up CloudDNS access
managed-dns: check-env-sub-domain select-workspace
	terraform apply -target=module.clouddns-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done created GCP managed DNS"

.PHONY:
## external-dns: Installs external-dns
external-dns: check-env-cloud select-workspace
	terraform apply -target=module.$(cloud)-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating externaldns for $(cloud)"

.PHONY:
## get-kubeconfig: Returns KUBECONFIG of a just created cluster
get-kubeconfig:
	echo "Getting kubeconfig for $$TF_VAR_TEST_ID terraform state" && \
    export provider=$$(echo "$$TF_VAR_TEST_ID" | sed 's/\(.*\)-/\1 /' | xargs | awk '{print $$2}') && \
	$(MAKE) $$provider-kubeconfig && echo "kubeconfig written to ${KUBECONFIG}"

get-github-config:
ifneq ($(GITHUB_SCM_OAUTH),)
	export SCM_OAUTH=./manifests/github-oauth.yaml && \
	cat $$GITHUB_SCM_OAUTH > $$SCM_OAUTH && \
	yq w -i $$SCM_OAUTH 'oauth.callBackUrl' https://scm.${TF_VAR_domain}/auth/github.com/callback?state=${TF_VAR_TEST_ID} && \
	kubectl --kubeconfig=${KUBECONFIG} create secret generic "github-oauth" \
		--from-literal=provider="$$(cat $$SCM_OAUTH)" \
		-o yaml --dry-run=client > ${github_oauth_secret}
	echo -en  "authProviders:\n  - kind: secret\n    name: github-oauth\n" | base64 -w 0 > ${config_patch}
else
	echo "Skipping github setup since var GITHUB_SCM_OAUTH is not set"
endif


KOTS_KONFIG := "./manifests/kots-config.yaml"

get-base-config:
	export DOMAIN=${TF_VAR_domain} && \
	export PATCH=$$(cat ${config_patch}) || export PATCH="" && \
	envsubst < ${KOTS_KONFIG} > tmp_config.yml

storage-config-gcp:
	export BASE64_GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	envsubst < ./manifests/kots-config-gcp-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-gcp:
	export GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | jq -Rsa .) && \
	envsubst < ./manifests/kots-config-gcp-registry.yaml > tmp_4_config.yml
	yq m -i tmp_config.yml tmp_4_config.yml

db-config-gcp:
	export BASE64_GCP_KEY=$$(cat $$TF_VAR_sa_creds | tr -d '\n' | base64 -w 0) && \
	export DB_OUTPUT=$$(terraform output -json k3s_database || terraform output -json gke_database) && \
	export DB_INSTANCE=$$(echo $$DB_OUTPUT | yq r - 'instance') && \
	export DB_PASSWORD=$$(echo $$DB_OUTPUT | yq r - 'password') && \
	export DB_USER=$$(echo $$DB_OUTPUT | yq r - 'username') && \
	envsubst < ./manifests/kots-config-gcp-db.yaml > tmp_4_config.yml
	envsubst < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

registry-config-azure:
	export SERVER=$$(terraform output -json azure_registry | yq r - 'server') && \
	export URL=$$(terraform output -json azure_registry | yq r - 'url') && \
	export PASSWORD=$$(terraform output -json azure_registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json azure_registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage-config-azure:
	export USERNAME=$$(terraform output -json azure_storage | yq r - 'account_name') && \
	export PASSWORD=$$(terraform output -json azure_storage | yq r - 'account_key') && \
	export REGION=$$(terraform output -json azure_storage | yq r - 'storage_region') && \
	envsubst < ./manifests/kots-config-azure-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

db-config-azure:
	export DBHOST=$$(terraform output -json azure_database | yq r - 'host') && \
	export DBPASS=$$(terraform output -json azure_database | yq r - 'password') && \
	export DBUSER=$$(terraform output -json azure_database | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

db-config-aws:
	export DBHOST=$$(terraform output -json aws_database | yq r - 'host') && \
	export DBPASS=$$(terraform output -json aws_database | yq r - 'password') && \
	export DBUSER=$$(terraform output -json aws_database | yq r - 'username') && \
	envsubst < ./manifests/kots-config-aws-db.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage-config-aws:
	export REGION=$$(terraform output -json aws_storage | yq r - 'region') && \
	export ENDPOINT=$$(terraform output -json aws_storage | yq r - 'endpoint') && \
	export BUCKET=$$(terraform output -json aws_storage | yq r - 'bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(terraform output -json aws_storage | yq r - 'access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(terraform output -json aws_storage | yq r - 'secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-storage.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

s3-registry-backend-config-aws: # this registry config involves using s3 backend for incluster registry
	export REGION=$$(terraform output -json aws_s3_registry_backend | yq r - 'region') && \
	export ENDPOINT=$$(terraform output -json aws_s3_registry_backend | yq r - 'endpoint') && \
	export BUCKET=$$(terraform output -json aws_s3_registry_backend | yq r - 'bucket_name') && \
	export S3_ACCESS_KEY_ID=$$(terraform output -json aws_s3_registry_backend | yq r - 'access_key_id') && \
	export S3_SECRET_ACCESS_KEY=$$(terraform output -json aws_s3_registry_backend | yq r - 'secret_access_key') && \
	envsubst < ./manifests/kots-config-aws-s3-backend.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

registry-config-aws:
	export SERVER=$$(terraform output -json aws_registry | yq r - 'server' | cut -d / -f 1) && \
	export PASSWORD=$$(terraform output -json aws_registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json aws_registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-aws-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

self-signed-config:
	# install in local store
	mkcert -install

	cat "${HOME}"/.local/share/mkcert/rootCA.pem > ./ca.pem
	mkcert -cert-file "./ssl.crt" \
	  -key-file "./ssl.key" \
	  "*.ws.${TF_VAR_TEST_ID}.${TF_VAR_domain}" "*.${TF_VAR_TEST_ID}.${TF_VAR_domain}" "${TF_VAR_TEST_ID}.${TF_VAR_domain}"

	export CA_CERT=$$(cat ./ca.pem | base64 -w 0) && \
	export SSL_CERT=$$(cat ./ssl.crt | base64 -w 0) && \
	export SSL_KEY=$$(cat ./ssl.key | base64 -w 0) && \
	envsubst < ./manifests/kots-config-self-signed.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

	# upload the Custom CA Cert into tf-state
	gsutil cp ./ca.pem gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-ca.pem

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
skipTests ?= "false"
self_signed ?= "false"
.PHONY:
generate-kots-config: cloud_storage = $(if $(findstring external,$(storage)),$(cloud),incluster)
generate-kots-config: cloud_registry = $(if $(findstring external,$(registry)),$(cloud),incluster)
generate-kots-config: cloud_db = $(if $(findstring external,$(db)),$(cloud),incluster)
## generate-kots-config: Generate the kots config based on test config
generate-kots-config: select-workspace check-env-cloud check-env-domain check-env-sub-domain
	if [[ $$skipTests == "false" ]]; then $(MAKE) get-github-config; fi
	$(MAKE) get-base-config
	$(MAKE) storage-config-${cloud_storage}
	$(MAKE) db-config-${cloud_db}
	$(MAKE) registry-config-${cloud_registry}
	if [[ $$self_signed == "true" ]]; then $(MAKE) self-signed-config; fi

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

install-kots-cli:
	curl https://kots.io/install | bash

preflights ?= true
channel ?= unstable
app ?= gitpod
version ?= -
kots-install: version-flag = $(if $(version:-=),--app-version-label=$(version),)
kots-install: preflight-flag = $(if $(preflights:true=),--skip-preflights,)
kots-install: license-file = $(if $(license_community_$(channel)),$(license_community_$(channel)),"../licenses/$(channel).yaml")
kots-install: install-kots-cli destroy-gitpod create-secrets
	kubectl kots install ${app}/${channel} \
	--skip-rbac-check ${version-flag} ${preflight-flag} \
					--wait-duration "10m" \
					--namespace gitpod --kubeconfig=${KUBECONFIG} \
                    --name gitpod --shared-password gitpod \
					--license-file ${license-file} \
                    --no-port-forward \
                    --config-values tmp_config.yml

time_to_sleep_azure := 1000 # azure seem to take more time to fullfil DNS propogation
time_to_sleep := 800

wait_time := 180
wait_time_azure := 300

delete-cm-setup: sleeptime=$(if $(time_to_sleep_$(cloud)),$(time_to_sleep_$(cloud)),${time_to_sleep})
delete-cm-setup: waittime=$(if $(wait_time_$(cloud)),$(wait_time_$(cloud)),${wait_time})
delete-cm-setup:
	sleep ${waittime} && kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager && sleep ${sleeptime};

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
	kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $$2}' | grep "ready" || { $(MAKE) gitpod-debug-info; exit 1; }

self_signed ?= false

check-gitpod-installation: delete-cm-setup check-kots-app check-env-sub-domain
	@echo "Curling https://${TF_VAR_TEST_ID}.${TF_VAR_domain}/api/version"
ifeq (true,$(self_signed))
	export SSL_CERT_FILE=./ca.pem
endif
	curl -i -X GET https://${TF_VAR_TEST_ID}.${TF_VAR_domain}/api/version || { echo "Curling Gitpod endpoint failed"; exit 1; }

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

cloud ?= cluster
cleanup: get-kubeconfig destroy-gitpod tf-init destroy-$(cloud) destroy-workspace destroy-kubeconfig

cluster-kubeconfig: azure-kubeconfig aws-kubeconfig k3s-kubeconfig gcp-kubeconfig

tf-init:
	@terraform init

destroy-cluster: destroy-gcp destroy-aws destroy-azure

destroy-kubeconfig:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig || echo "No kubeconfig"
	gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-creds || echo "No credentials file"
	gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-ca.pem || echo "No custom CA cert file"
	rm ${KUBECONFIG} || echo "No kubeconfig"

select-workspace:
	terraform workspace select $(TF_VAR_TEST_ID)

destroy-workspace:
	terraform workspace select default
	terraform workspace delete $(TF_VAR_TEST_ID) || echo "Couldn't delete workspace, please cleanup manually"

destroy-gcp: destroy-k3s destroy-gke

destroy-k3s: select-workspace
	[[ -f ${KUBECONFIG} ]] && terraform destroy -target=module.gcp-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	[[ -f ${KUBECONFIG} ]] && terraform destroy -target=module.clouddns-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	[[ -f ${KUBECONFIG} ]] && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.k3s -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-gke: select-workspace
	[[ -f ${KUBECONFIG} ]] && terraform destroy -target=module.gcp-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	[[ -f ${KUBECONFIG} ]] && terraform destroy -target=module.clouddns-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	[[ -f ${KUBECONFIG} ]] && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve

# Delete the Gitpod namespace and all associated resources.
#
# The sleep following deletion adds a bit of padding so that external resources (such
# as AWS ELBs generated from LoadBalancer type services) can terminate.
destroy-gitpod: backup-cert
	[[ -f ${KUBECONFIG} ]] \
		&& kubectl --kubeconfig=${KUBECONFIG} delete namespace/gitpod --now --timeout 180s \
		|| true

destroy-aws:
	$(MAKE) select-workspace
	terraform destroy -target=module.aws-add-dns-record -var kubeconfig=${KUBECONFIG} --auto-approve
	ls ${KUBECONFIG} && terraform destroy -target=module.aws-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.aws-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.eks -var kubeconfig=${KUBECONFIG} --auto-approve

destroy-azure:
	$(MAKE) select-workspace
	ls ${KUBECONFIG} && terraform destroy -target=module.azure-issuer -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.azure-add-dns-record -var kubeconfig=${KUBECONFIG} --auto-approve
	ls ${KUBECONFIG} && terraform destroy -target=module.azure-externaldns -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	ls ${KUBECONFIG} && terraform destroy -target=module.certmanager -var kubeconfig=${KUBECONFIG} --auto-approve || echo "No kubeconfig file"
	terraform destroy -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve

backup-cert:
	@echo "Backing up certificate secret to GCS"
	@kubectl --kubeconfig=${KUBECONFIG} get secret -n gitpod https-certificates -o yaml > ${cert_secret} \
		&& echo "---" >> ${cert_secret} \
		&& kubectl --kubeconfig=${KUBECONFIG} get certificate -n gitpod https-certificates -o yaml >> ${cert_secret} \
		|| { echo "No existing secret"; rm -f ${cert_secret}; }
	@[[ -f ${cert_secret} ]] && gsutil cp ${cert_secret} gs://nightly-tests/nightly-tests-certs/${cert_secret} || echo "No certificate secret file exist"

list-state:
	terraform state list

cleanup-old-tests:
	./cleanup.sh

# end
