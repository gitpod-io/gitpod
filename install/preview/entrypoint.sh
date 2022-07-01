#!/bin/sh
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

set -e

if [ "$1" != "logging" ]; then
  $0 logging 2>&1 | /prettylog
  exit
fi

# check for minimum requirements
REQUIRED_MEM_KB=$((6 * 1024 * 1024))
total_mem_kb=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
if [ "${total_mem_kb}" -lt "${REQUIRED_MEM_KB}" ]; then
    echo "Preview installation of Gitpod requires a system with at least 6GB of memory"
    exit 1
else
  set -x
fi

REQUIRED_CORES=4
total_cores=$(nproc)
if [ "${total_cores}" -lt "${REQUIRED_CORES}" ]; then
    echo "Preview installation of Gitpod requires a system with at least 4 CPU Cores"
    exit 1
fi

# Get container's IP address
if [ -z "${DOMAIN}" ]; then
  NODE_IP=$(hostname -i)
  DOMAIN_STRING=$(echo "${NODE_IP}" | sed "s/\./-/g")
  DOMAIN="${DOMAIN_STRING}.nip.io"
fi

echo "Gitpod Domain: $DOMAIN"

if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  echo "[$(date -Iseconds)] [CgroupV2 Fix] Evacuating Root Cgroup ..."
	# move the processes from the root group to the /init group,
  # otherwise writing subtree_control fails with EBUSY.
  mkdir -p /sys/fs/cgroup/init
  busybox xargs -rn1 < /sys/fs/cgroup/cgroup.procs > /sys/fs/cgroup/init/cgroup.procs || :
  # enable controllers
  sed -e 's/ / +/g' -e 's/^/+/' <"/sys/fs/cgroup/cgroup.controllers" >"/sys/fs/cgroup/cgroup.subtree_control"
  echo "[$(date -Iseconds)] [CgroupV2 Fix] Done"
fi

mount --make-shared /sys/fs/cgroup
mount --make-shared /proc
mount --make-shared /var/gitpod

# install in local store
mkcert -install
cat "${HOME}"/.local/share/mkcert/rootCA.pem >> /etc/ssl/certs/ca-certificates.crt
# also send root cert into a volume
cat "${HOME}"/.local/share/mkcert/rootCA.pem > /var/gitpod/gitpod-ca.crt

cat << EOF > /var/lib/rancher/k3s/server/manifests/ca-pair.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ca-key-pair
data:
  ca.crt: $(base64 -w0 "${HOME}"/.local/share/mkcert/rootCA.pem)
  tls.crt: $(base64 -w0 "${HOME}"/.local/share/mkcert/rootCA.pem)
  tls.key: $(base64 -w0 "${HOME}"/.local/share/mkcert/rootCA-key.pem)
EOF

cat << EOF > /var/lib/rancher/k3s/server/manifests/issuer.yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: ca-issuer
spec:
  ca:
    secretName: ca-key-pair
EOF

echo "creating Gitpod SSL secret..."
cat << EOF > /var/lib/rancher/k3s/server/manifests/https-cert.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: https-cert
spec:
  secretName: https-certificates
  issuerRef:
    name: ca-issuer
    kind: Issuer
  dnsNames:
    - "$DOMAIN"
    - "*.$DOMAIN"
    - "*.ws.$DOMAIN"
EOF

mkdir -p /var/lib/rancher/k3s/server/manifests/gitpod

/gitpod-installer init > config.yaml
yq e -i '.domain = "'"${DOMAIN}"'"' config.yaml
yq e -i '.certificate.name = "https-certificates"' config.yaml
yq e -i '.certificate.kind = "secret"' config.yaml
yq e -i '.customCACert.name = "ca-key-pair"' config.yaml
yq e -i '.customCACert.kind = "secret"' config.yaml
yq e -i '.observability.logLevel = "debug"' config.yaml
yq e -i '.workspace.runtime.containerdSocket = "/run/k3s/containerd/containerd.sock"' config.yaml
yq e -i '.workspace.runtime.containerdRuntimeDir = "/var/lib/rancher/k3s/agent/containerd/io.containerd.runtime.v2.task/k8s.io/"' config.yaml
yq e -i '.experimental.telemetry.data.platform = "local-preview"' config.yaml

echo "extracting images to download ahead..."
/gitpod-installer render --use-experimental-config --config config.yaml | grep 'image:' | sed 's/ *//g' | sed 's/image://g' | sed 's/\"//g' | sed 's/^-//g' | sort | uniq > /gitpod-images.txt
echo "downloading images..."
while read -r image "$(cat /gitpod-images.txt)"; do
   # shellcheck disable=SC2154
   ctr images pull "$image" >/dev/null &
done

ctr images pull "docker.io/gitpod/workspace-full:latest" >/dev/null &

/gitpod-installer render --use-experimental-config --config config.yaml --output-split-files /var/lib/rancher/k3s/server/manifests/gitpod

# store files in `gitpod.debug` for debugging purposes
for f in /var/lib/rancher/k3s/server/manifests/gitpod/*.yaml; do (cat "$f"; echo) >> /var/lib/rancher/k3s/server/gitpod.debug; done
# remove NetowrkPolicy resources as they are not relevant here
rm /var/lib/rancher/k3s/server/manifests/gitpod/*NetworkPolicy*
# update PersistentVolumeClaim's to use k3s's `local-path` storage class
for f in /var/lib/rancher/k3s/server/manifests/gitpod/*PersistentVolumeClaim*.yaml; do yq e -i '.spec.storageClassName="local-path"' "$f"; done
# Set `volumeClassTemplate` so that each replica creates its own PVC
yq eval-all -i ". as \$item ireduce ({}; . *+ \$item)" /var/lib/rancher/k3s/server/manifests/gitpod/*_StatefulSet_messagebus.yaml /app/manifests/messagebus.yaml
# update Statefulset's to use k3s's `local-path` storage class
for f in /var/lib/rancher/k3s/server/manifests/gitpod/*StatefulSet*.yaml; do yq e -i '.spec.volumeClaimTemplates[0].spec.storageClassName="local-path"' "$f"; done

# removing init container from ws-daemon (systemd and Ubuntu)
yq eval-all -i 'del(.spec.template.spec.initContainers[0])' /var/lib/rancher/k3s/server/manifests/gitpod/*_DaemonSet_ws-daemon.yaml

for f in /var/lib/rancher/k3s/server/manifests/gitpod/*.yaml; do (cat "$f"; echo) >> /var/lib/rancher/k3s/server/manifests/gitpod.yaml; done
rm -rf /var/lib/rancher/k3s/server/manifests/gitpod

# waits for gitpod pods to be ready, and manually runs the `gitpod-telemetry` cronjob
run_telemetry(){
  # wait for the k3s cluster to be ready and Gitpod workloads are added
  sleep 100
  # indefinitely wait for Gitpod pods to be ready
  kubectl wait --timeout=-1s --for=condition=ready pod -l app=gitpod,component!=migrations
  # manually tun the cronjob
  kubectl create job gitpod-telemetry-init --from=cronjob/gitpod-telemetry
}

run_telemetry 2>&1 &

/bin/k3s server --disable traefik \
  --node-label gitpod.io/workload_meta=true \
  --node-label gitpod.io/workload_ide=true \
  --node-label gitpod.io/workload_workspace_services=true \
  --node-label gitpod.io/workload_workspace_regular=true \
  --node-label gitpod.io/workload_workspace_headless=true
