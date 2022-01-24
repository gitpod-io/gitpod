#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


set -u

GCP_PROJECT=clu-self-hosted-playground
GCP_PROJECT_DNS=dns-for-playgrounds

CLOUDDNS_SERVICE_ACCOUNT=clu-dns01-solver
CLOUDDNS_DOMAIN_ZONE=gitpod-self-hosted-com

GITPOD_DOMAIN=clu-gcp-k3s-2.gitpod-self-hosted.com

GCP_BUCKET_NAME=clu-gcp-k3s

if [[ "$(gcloud config get-value project)" != "$GCP_PROJECT" ]]; then
    gcloud auth login --no-launch-browser
    gcloud config set project clu-self-hosted-playground
fi

if kubectl get secret https-certificates >/dev/null 2>/dev/null; then
    echo "backup certificates"
    gcloud compute ssh gitpod-main-node --command 'kubectl get secret gitpod-issuer-account-key -o yaml -n cert-manager' | gsutil cp - gs://${GCP_BUCKET_NAME}/gitpod-issuer-account-key.yaml
    gcloud compute ssh gitpod-main-node --command 'kubectl get secret https-certificates -o yaml' | gsutil cp - gs://${GCP_BUCKET_NAME}/https-certificates.yaml
fi

echo "delete VM"
gcloud compute instances delete --quiet --zone "europe-west1-b" gitpod-main-node

echo "remove DNS"
gcloud dns --project=$GCP_PROJECT_DNS record-sets delete --quiet "${GITPOD_DOMAIN}." --type="A" --zone="$CLOUDDNS_DOMAIN_ZONE"
gcloud dns --project=$GCP_PROJECT_DNS record-sets delete --quiet "*.${GITPOD_DOMAIN}." --type="A" --zone="$CLOUDDNS_DOMAIN_ZONE"
gcloud dns --project=$GCP_PROJECT_DNS record-sets delete --quiet "*.ws.${GITPOD_DOMAIN}." --type="A" --zone="$CLOUDDNS_DOMAIN_ZONE"

echo "delete firewall rule"
gcloud compute firewall-rules delete --quiet allow-everything

echo "delete Cloud DNS service account"
gcloud --project=$GCP_PROJECT_DNS projects remove-iam-policy-binding "$GCP_PROJECT_DNS" \
    --member "serviceAccount:${CLOUDDNS_SERVICE_ACCOUNT}@${GCP_PROJECT_DNS}.iam.gserviceaccount.com" \
    --role roles/dns.admin
gcloud --project=$GCP_PROJECT_DNS iam service-accounts delete --quiet "${CLOUDDNS_SERVICE_ACCOUNT}@${GCP_PROJECT_DNS}.iam.gserviceaccount.com"
