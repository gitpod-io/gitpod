.DEFAULT_GOAL := help
SHELL := /bin/bash

PROJECTNAME := "installer-nightly-tests"

TOPDIR=$(shell pwd)

KUBECONFIG := "$(TOPDIR)/kubeconfig"

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
	gcloud container clusters get-credentials gitpod-${TF_VAR_TEST_ID} --zone europe-west1-d --project sh-automated-tests || $(MAKE) sync-kubeconfig || echo "No cluster present"

## azure-kubeconfig: Get the kubeconfig configuration for Azure AKS
azure-kubeconfig:
	export KUBECONFIG=${KUBECONFIG} && \
	export resource=$$(echo "$$TF_VAR_TEST_ID" | sed "s/[\\W\\-]//") && \
	az aks get-credentials --name gitpod-test-nor-primary-$$resource --resource-group gitpod-test-nor-$$resource --file ${KUBECONFIG} || echo "No cluster present"

## aws-kubeconfig: Get the kubeconfig configuration for AWS EKS
aws-kubeconfig:
	export KUBECONFIG=${KUBECONFIG} && \
	aws eks update-kubeconfig --name ${TF_VAR_TEST_ID} --region eu-west-1 --kubeconfig ${KUBECONFIG} || echo "No cluster present"


.PHONY:
## gke-standard-cluster: Creates a zonal GKE cluster
gke-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	terraform apply -target=module.gke -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating GKE cluster"

ami_id_120 := "ami-0ecb917eb4fbf4387"

ami_id_121 := "ami-0d57fb01036fac543"

ami_id_122 := "ami-0b306cb7e98db98e4"

.PHONY:
## eks-standard-cluster: Creates an EKS cluster
eks-standard-cluster: ami_id = $(if $(ami_id_${TF_VAR_cluster_version//.}),$(ami_id_${TF_VAR_cluster_version//.}),$(ami_id_122))
eks-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	terraform apply -target=module.eks -var kubeconfig=${KUBECONFIG} -var eks_node_image_id=${ami_id} --auto-approve
	@echo "Done creating EKS cluster"

.PHONY:
## aks-standard-cluster: Creates an AKS cluster
aks-standard-cluster: check-env-cluster-version
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || $(MAKE) select-workspace && \
	terraform apply -target=module.aks -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating AKS cluster"

.PHONY:
## add-ns-record: Adds NS record for subdomain under gitpod-selfhosted.com
add-ns-record: check-env-cloud
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-add-dns-record  -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done adding NS record"

.PHONY:
## cluster-issuer: Creates a cluster issuer for the correspondign provider
cluster-issuer: check-env-cloud
	terraform init --upgrade && \
	terraform workspace new $(TF_VAR_TEST_ID) || terraform workspace select $(TF_VAR_TEST_ID) && \
	terraform apply -target=module.$(cloud)-issuer  -var kubeconfig=${KUBECONFIG} --auto-approve
	@echo "Done creating cluster issuer"

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
	terraform apply -target=module.k3s -var kubeconfig=${KUBECONFIG} -var k3s_node_image_id=${image_id} --auto-approve && \
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
get-kubeconfig: ${cloud}-kubeconfig

KOTS_KONFIG := "./manifests/kots-config.yaml"

get-base-config:
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
	envsubst < ./manifests/kots-config-gcp-db.yaml > tmp_4_config.yml
	envsubst < tmp_4_config.yml > tmp_5_config.yml
	yq m -i tmp_config.yml tmp_5_config.yml

registry-config-azure:
	export SERVER=$$(terraform output -json azure_registry | yq r - 'server') && \
	export PASSWORD=$$(terraform output -json azure_registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json azure_registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-azure-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage-config-azure:
	export PASSWORD=$$(terraform output -json azure_storage | yq r - 'password') && \
	export USERNAME=$$(terraform output -json azure_storage | yq r - 'username') && \
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

registry-config-aws:
	export SERVER=$$(terraform output -json aws_registry | yq r - 'server' | cut -d / -f 1) && \
	export PASSWORD=$$(terraform output -json aws_registry | yq r - 'password') && \
	export USERNAME=$$(terraform output -json aws_registry | yq r - 'username') && \
	envsubst < ./manifests/kots-config-aws-registry.yaml > tmp_2_config.yml
	yq m -i tmp_config.yml tmp_2_config.yml

storage-config-incluster:
	@echo "Nothing to do"

db-config-incluster:
	@echo "Nothing to do"

registry-config-incluster:
	@echo "Nothing to do"

torage ?= incluster
registry ?= incluster
db ?= incluster
.PHONY:
generate-kots-config: cloud_storage = $(if $(findstring external,$(storage)),$(cloud),incluster)
generate-kots-config: cloud_registry = $(if $(findstring external,$(registry)),$(cloud),incluster)
generate-kots-config: cloud_db = $(if $(findstring external,$(db)),$(cloud),incluster)
## generate-kots-config: Generate the kots config based on test config
generate-kots-config: check-env-cloud get-base-config
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

time_to_sleep_azure := 600 # azure seem to take more time to fullfil DNS propogation
time_to_sleep := 300

delete-cm-setup: sleeptime=$(if $(time_to_sleep_$(cloud)),$(time_to_sleep_$(cloud)),${time_to_sleep})
delete-cm-setup:
	sleep 180 && kubectl --kubeconfig=${KUBECONFIG} delete pods --all -n cert-manager && sleep ${sleeptime};

gitpod-debug-info:
	@echo "Gitpod is not ready"
	@kubectl get pods -n gitpod
	@kubectl get certificate -n gitpod

check-kots-app:
	kubectl kots get --kubeconfig=${KUBECONFIG} app gitpod -n gitpod | grep gitpod  | awk '{print $$2}' | grep "ready" || { $(MAKE) gitpod-debug-info; exit 1; }

check-gitpod-installation: delete-cm-setup check-kots-app check-env-sub-domain
	@echo "Curling http://${TF_VAR_TEST_ID}.tests.gitpod-self-hosted.com/api/version"
	curl -i -X GET http://${TF_VAR_TEST_ID}.tests.gitpod-self-hosted.com/api/version || { echo "Curling Gitpod endpoint failed"; exit 1; }

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
	$(call runtests,"test/tests/components/content-service/")

run-wsd-component-tests:
	$(call runtests,"test/tests/components/ws-daemon/")

run-wsm-component-tests:
	$(call runtests,"test/tests/components/ws-manager/")

kots-upgrade:
	@echo "Upgrade gitpod KOTS app to latest"
	kubectl kots upstream upgrade --kubeconfig=${KUBECONFIG} gitpod -n gitpod --deploy

cloud ?= cluster
cleanup: $(cloud)-kubeconfig destroy-gitpod destroy-$(cloud) destroy-workspace destroy-kubeconfig

cluster-kubeconfig: azure-kubeconfig aws-kubeconfig k3s-kubeconfig gcp-kubeconfig

destroy-cluster: destroy-gcp destroy-aws destroy-azure

destroy-kubeconfig:
	gcloud auth activate-service-account --key-file=${GOOGLE_APPLICATION_CREDENTIALS} --project=sh-automated-tests
	gsutil rm gs://nightly-tests/tf-state/${TF_VAR_TEST_ID}-kubeconfig || echo "No kubeconfig"
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
destroy-gitpod:
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

list-state:
	terraform state list

cleanup-old-tests:
	./cleanup.sh

# end
