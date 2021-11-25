#!/bin/bash

# to test, follow these steps
# 1. render k8s manifests from an installer config
# 2. get the result this echos, MATCHES="$(cat k8s.yaml | grep -- '---' | wc -l)";echo -n $((($MATCHES - 1) / 2))
# 3. pass in the echoed result (not $MATCHES) from #2 as the value for DOCS, pass in fake values for the PORTS and index
# 4. call this script

set -e

DOCS=$1
REG_DAEMON_PORT=$2
WS_DAEMON_PORT=$3
NODE_POOL_INDEX=$4
i=0

echo "Use node pool index $NODE_POOL_INDEX"

while [ "$i" -le "$DOCS" ]; do
   # override daemon sets which bind to an actual node port via the hostPort setting on the pod
   unset PORT SIZE NAME UNSET
   PORT=$(yq r k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].hostPort)
   SIZE="${#PORT}"
   NAME=$(yq r k8s.yaml -d "$i" metadata.name)
   KIND=$(yq r k8s.yaml -d "$i" kind)
   if [[ "$SIZE" -ne "0" ]] && [[ "$NAME" == "registry-facade" ]]; then
      echo "setting $NAME to $REG_DAEMON_PORT"
      yq w -i k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].hostPort "$REG_DAEMON_PORT"
   fi
   if [[ "$SIZE" -ne "0" ]] && [[ "$NAME" == "ws-daemon" ]]; then
      echo "setting $NAME to $WS_DAEMON_PORT"
      yq w -i k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].hostPort "$WS_DAEMON_PORT"
   fi
   # override labels for pod scheduling on nodes
      # the workspace pool depends on $NODE_POOL_INDEX
      # includes: image-builder, image-builder-mk3, registry-facade, ws-daemon, agent-smith
      # i.e. gitpod.io/workspace_0=true

      # meta has one pool of nodes.

      # TODO: ws-manager's template should denote where to put workspace and image build workspaces
      # test and see where workspaces spin up
   WORKSPACE_COMPONENTS=("image-builder" "image-builder-mk3 blobserve registry-facade" "ws-daemon" "agent-smith")

   # shellcheck disable=SC2076
   if [[ " ${WORKSPACE_COMPONENTS[*]} " =~ " ${NAME} " ]] && { [[ "$KIND" == "Deployment" ]] || [[ "$KIND" == "DaemonSet" ]]; }; then
      LABEL="gitpod.io/workspace_$NODE_POOL_INDEX"
      echo "setting $LABEL for $NAME"
      touch "$NAME"pool.yaml
      # create a matching expression
      yq w -i "$NAME"pool.yaml spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key "$LABEL"
      yq w -i "$NAME"pool.yaml spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].operator Exists
      # append it
      yq m --arrays=overwrite -i k8s.yaml -d "$i" "$NAME"pool.yaml
   elif [[ "$KIND" == "DaemonSet" ]] || [[ "$KIND" == "Deployment" ]] || [[ "$KIND" == "StatefulSet" ]] || [[ "$KIND" == "Job" ]]; then
      LABEL="gitpod.io/workload_meta"
      echo "setting $LABEL for $NAME"
      touch "$NAME"pool.yaml
      # create a matching expression
      yq w -i "$NAME"pool.yaml spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key "$LABEL"
      yq w -i "$NAME"pool.yaml spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].operator Exists
      # append it
      yq m --arrays=overwrite -i k8s.yaml -d "$i" "$NAME"pool.yaml
   fi

   # TODO: Set config for Server
   #           theiaPluginsBucketNameOverride: gitpod-core-dev-plugins
   #           enableLocalApp = true

   i=$((i + 1))
done

exit
