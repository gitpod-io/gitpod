#!/bin/bash

# This script will patch the servers config map, install the app cert and restart the server components
# It is best to add the envs to your environment variables using `gp env GH_APP_ID=....` and `gp env GH_APP_KEY="..."`.
# See https://www.notion.so/gitpod/How-to-deploy-a-PR-with-a-working-GitHub-App-integration-d297a1ef2f7b4b3aa8483b2ae9b47da2 (internal) for more details.
# GH_APP_ID=<app-id>
# GH_APP_KEY="-----BEGIN RSA PRIVATE KEY-----
# ...
# -----END RSA PRIVATE KEY-----"
#############################

if [ -z "$GH_APP_ID" ]; then
  echo "Missing env GH_APP_ID"
  return
fi

if [ -z "${GH_APP_KEY}" ]; then
  echo "Missing env GH_APP_KEY"
  return
fi

# turn spaces into newlines, in case the key got pasted in on the env var dashboard interface
TMP=${GH_APP_KEY// RSA PRIVATE /RSA_PRIVATE}
TMP2=${TMP// /$'\n'}
GH_APP_KEY=${TMP2//RSA_PRIVATE/ RSA PRIVATE }


echo 'patching configmap server-config'
LINE="\"githubApp\": \{\"appId\":${GH_APP_ID},\"authProviderId\":\"Public-GitHub\",\"certPath\":\"\/github-app-cert\/cert\",\"certSecretName\":\"server-github-app-cert\",\"enabled\":true,\"marketplaceName\":\"gitpod-io\",\"webhookSecret\":\"omgsecret\"}"
kubectl get cm server-config -o yaml > server-config.yml
perl -0777 -i.original -pe "s/\"githubApp\":.+?\}/$LINE/igs" server-config.yml
kubectl apply -f server-config.yml
rm server-config.yml
rm server-config.yml.original

echo 'updating the secret'
kubectl delete secret server-github-app-cert
kubectl create secret generic server-github-app-cert --from-literal=cert="$GH_APP_KEY"

if kubectl get deployment server -o json | grep -q 'github-app-cert-secret'; then
  echo 'deployment already contains github-app-cert-volume. Skipping patching server deployment.'
else
  echo 'updating server deployment'
  kubectl get deployment server -o json | \
    sed -E "s|\"volumeMounts\": \[|\"volumeMounts\": \[ {\"name\": \"github-app-cert-secret\", \"readOnly\": true, \"mountPath\": \"/github-app-cert\"},|" | \
    sed -E "s|\"volumes\": \[|\"volumes\": \[ {\"name\": \"github-app-cert-secret\", \"secret\": { \"secretName\": \"server-github-app-cert\"}},|" | \
    kubectl apply -f -
fi
echo 'restarting server deployment'
kubectl rollout restart deployment server
