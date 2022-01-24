#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


set -euo pipefail
trap 'catch $? "$0"' EXIT

catch() {
  if [ "$1" != "0" ]; then
    echo "$2: Error $1"
  fi
}

GCP_PROJECT=clu-self-hosted-playground
GCP_PROJECT_DNS=dns-for-playgrounds

# available images: gcloud compute images list
VM_IMAGE_FAMILY=ubuntu-2004-lts
VM_IMAGE_PROJECT=ubuntu-os-cloud
# available types: gcloud compute machine-types list --zones=europe-west1-b
VM_MACHINE_TYPE=c2-standard-4
VM_BOOT_DISK_SIZE="128GB"

GITPOD_INSTALLER_TAG=main.2121

CLOUDDNS=true
CLOUDDNS_SERVICE_ACCOUNT=clu-dns01-solver
CLOUDDNS_DOMAIN_ZONE=gitpod-self-hosted-com

WITH_GITHUB_AUTH_PROVIDER=true

GITPOD_DOMAIN=clu-gcp-k3s-2.gitpod-self-hosted.com

GCP_BUCKET_NAME=clu-gcp-k3s

if [[ "$(gcloud config get-value project)" != "$GCP_PROJECT" ]]; then
    if [[ -f "/service-account.json" ]]; then
      gcloud auth activate-service-account --key-file=/service-account.json
    else
      gcloud auth login --no-launch-browser
    fi
    gcloud config set project "$GCP_PROJECT"
fi

echo "prepare provisioning"
TMP_DIR=$(mktemp -d)
echo "using tmp dir: $TMP_DIR"
mkdir -p "$TMP_DIR/manifests"

cp ./provisions/main-node.sh "$TMP_DIR/provision.sh"
cp ./provisions/manifests/* "$TMP_DIR/manifests/"

if [[ ! -f "/installer/gitpod-installer" ]]; then
    docker create --name installer eu.gcr.io/gitpod-core-dev/build/installer:$GITPOD_INSTALLER_TAG
    docker cp installer:/app/installer "$TMP_DIR/gitpod-installer"
    docker rm -f installer
fi
cp /installer/gitpod-installer "$TMP_DIR/gitpod-installer"

"$TMP_DIR/gitpod-installer" init > "$TMP_DIR/gitpod.config.yaml"
yq eval-all --inplace 'select(fileIndex == 0) * select(fileIndex == 1)' "$TMP_DIR/gitpod.config.yaml" ./provisions/gitpod.config-patch.yaml
yq eval --inplace ".domain = \"$GITPOD_DOMAIN\"" "$TMP_DIR/gitpod.config.yaml"

if [[ "$CLOUDDNS" == "true" ]]; then
    echo "create service account for ACME CloudDNS"
    gcloud --project=$GCP_PROJECT_DNS iam service-accounts create "$CLOUDDNS_SERVICE_ACCOUNT" --display-name "$CLOUDDNS_SERVICE_ACCOUNT"  || echo "Couldn't create CloudDNS service account. Does this account already exist?"
    gcloud --project=$GCP_PROJECT_DNS projects add-iam-policy-binding "$GCP_PROJECT_DNS" \
        --member "serviceAccount:${CLOUDDNS_SERVICE_ACCOUNT}@${GCP_PROJECT_DNS}.iam.gserviceaccount.com" \
        --role roles/dns.admin
    keyfile=$(mktemp)
    gcloud iam service-accounts keys create "$keyfile" \
        --iam-account ${CLOUDDNS_SERVICE_ACCOUNT}@${GCP_PROJECT_DNS}.iam.gserviceaccount.com
    keycontent=$(base64 -w0 "$keyfile")
    mkdir -p "$TMP_DIR/manifests"
    cat <<EOF > "$TMP_DIR/manifests/clouddns-dns01-solver-svc-acct-secret.yaml"
apiVersion: v1
kind: Secret
metadata:
  name: clouddns-dns01-solver-svc-acct
  namespace: cert-manager
data:
  key: $keycontent
EOF
    yq eval --inplace "select(.kind == \"ClusterIssuer\").spec.acme.solvers[0].dns01.cloudDNS.project |= \"${GCP_PROJECT_DNS}\"" "$TMP_DIR/manifests/https-certificates--google-clouddns.yaml"
    yq eval --inplace "select(.kind == \"Certificate\").spec.dnsNames |= [\"${GITPOD_DOMAIN}\", \"*.${GITPOD_DOMAIN}\", \"*.ws.${GITPOD_DOMAIN}\"]" "$TMP_DIR/manifests/https-certificates--google-clouddns.yaml"
    rm "$TMP_DIR/manifests/https-certificates--self-signed.yaml"
else
    rm "$TMP_DIR/manifests/https-certificates--google-clouddns.yaml"
    yq eval --inplace "select(.kind == \"Certificate\").spec.dnsNames |= [\"${GITPOD_DOMAIN}\", \"*.${GITPOD_DOMAIN}\", \"*.ws.${GITPOD_DOMAIN}\"]" "$TMP_DIR/manifests/https-certificates--self-signed.yaml"
fi

if [[ "$WITH_GITHUB_AUTH_PROVIDER" == true ]]; then
  gsutil cp gs://${GCP_BUCKET_NAME}/auth-provider-public-github.yaml "$TMP_DIR/manifests/"
  yq eval --inplace '.authProviders += [{"kind": "secret", "name": "auth-provider-public-github"}]' "$TMP_DIR/gitpod.config.yaml"
fi

mkdir -p "$TMP_DIR/certs"
gsutil cp gs://${GCP_BUCKET_NAME}/gitpod-issuer-account-key.yaml "$TMP_DIR/certs/" || echo "No backuped certs found."
gsutil cp gs://${GCP_BUCKET_NAME}/https-certificates.yaml "$TMP_DIR/certs/" || echo "No backuped certs found."
[[ -f "$TMP_DIR/certs/gitpod-issuer-account-key.yaml" ]] && yq eval --inplace "del(.metadata.resourceVersion)" "$TMP_DIR/certs/gitpod-issuer-account-key.yaml"
[[ -f "$TMP_DIR/certs/gitpod-issuer-account-key.yaml" ]] && yq eval --inplace "del(.metadata.uid)" "$TMP_DIR/certs/gitpod-issuer-account-key.yaml"
[[ -f "$TMP_DIR/certs/https-certificates.yaml" ]] && yq eval --inplace "del(.metadata.resourceVersion)" "$TMP_DIR/certs/https-certificates.yaml"
[[ -f "$TMP_DIR/certs/https-certificates.yaml" ]] && yq eval --inplace "del(.metadata.uid)" "$TMP_DIR/certs/https-certificates.yaml"

echo "create VM"
gcloud compute instances create gitpod-main-node \
    --zone "europe-west1-b" \
    --image-family "$VM_IMAGE_FAMILY" \
    --image-project "$VM_IMAGE_PROJECT" \
    --machine-type "$VM_MACHINE_TYPE" \
    --boot-disk-size "$VM_BOOT_DISK_SIZE"

echo "create firewall rule" # TODO
gcloud compute --project=$GCP_PROJECT firewall-rules create allow-everything --direction=INGRESS --priority=1000 --network=default --action=ALLOW --rules=all --source-ranges=0.0.0.0/0 || echo "Couldn't create firewall rule. Does this rule already exist?"

echo "configure DNS"
ip=$(gcloud compute instances describe gitpod-main-node --format json | jq -r .networkInterfaces[0].accessConfigs[0].natIP)
gcloud dns --project=$GCP_PROJECT_DNS record-sets create "${GITPOD_DOMAIN}." --rrdatas="$ip" --ttl="300" --type="A" --zone="$CLOUDDNS_DOMAIN_ZONE" || echo "Couldn't create DNS record. Does this record already exist?"
gcloud dns --project=$GCP_PROJECT_DNS record-sets create "*.${GITPOD_DOMAIN}." --rrdatas="$ip" --ttl="300" --type="A" --zone="$CLOUDDNS_DOMAIN_ZONE" || echo "Couldn't create DNS record. Does this record already exist?"
gcloud dns --project=$GCP_PROJECT_DNS record-sets create "*.ws.${GITPOD_DOMAIN}." --rrdatas="$ip" --ttl="300" --type="A" --zone="$CLOUDDNS_DOMAIN_ZONE" || echo "Couldn't create DNS record. Does this record already exist?"

echo "provision main node"
printf "waiting for the VM ..."
until [[ "$(gcloud compute ssh gitpod-main-node --quiet --zone "europe-west1-b" --command 'echo hello' 2>/dev/null)" == "hello" ]]; do printf "."; sleep 1; done; echo ""
gcloud compute scp --recurse "$TMP_DIR"/* gitpod-main-node:
gcloud compute ssh gitpod-main-node --command ./provision.sh
