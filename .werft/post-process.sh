#!/bin/bash

# to test, follow these steps
# 1. generate a config ./installer init > config.yaml
# 2. generate a k8s manifest from the config ./installer render -n $(kubens -c) -c config.yaml > k8s.yaml
# 2. call this script like so ./.werft/post-process.sh 1234 5678 2 branch-name (branch name with dashes, no slashes)

set -e

REG_DAEMON_PORT=$1
WS_DAEMON_PORT=$2
NODE_POOL_INDEX=$3
DEV_BRANCH=$4

i=0

# count YAML like lines in the k8s manifest file
# all K8s objects are duplicated in a config map, as a giant string
# exclude the objects in the config map so we can determine how many YAML docs to loop through
MATCHES="$(grep -c -- --- k8s.yaml)"
# get the read number of K8s manifest docs
DOCS="$(((MATCHES - 1) / 2))"

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

   # TODO: set ports for clients of the above hostDaemons

   # overrides for server-config
   if [[ "server-config" == "$NAME" ]] && [[ "$KIND" == "ConfigMap" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      touch "$NAME"overrides.yaml
      yq r k8s.yaml -d "$i" data | yq prefix - data > "$NAME"overrides.yaml

      THEIA_BUCKET_NAME=$(yq r ./.werft/values.dev.yaml components.server.theiaPluginsBucketNameOverride)
      THEIA_BUCKET_NAME_EXPR="s/\"theiaPluginsBucketNameOverride\": \"\"/\"theiaPluginsBucketNameOverride\": \"$THEIA_BUCKET_NAME\"/"
      sed -i "$THEIA_BUCKET_NAME_EXPR" "$NAME"overrides.yaml

      DEV_BRANCH_EXPR="s/\"devBranch\": \"\"/\"devBranch\": \"$DEV_BRANCH\"/"
      sed -i "$DEV_BRANCH_EXPR" "$NAME"overrides.yaml

      # InstallationShortname
      # is expected to look like ws-dev.<branch-name-with-dashes>.staging.gitpod-dev.com
      SHORT_NAME=$(yq r ./.werft/values.dev.yaml installation.shortname)
      GITPOD_HOSTNAME=$(yq r ./.werft/values.dev.yaml hostname)
      INSTALL_SHORT_NAME="ws-$SHORT_NAME.$DEV_BRANCH.$GITPOD_HOSTNAME"
      NAMESPACE=$(kubens -c)
      INSTALL_SHORT_NAME_EXPR="s/\"installationShortname\": \"$NAMESPACE\"/\"installationShortname\": \"$INSTALL_SHORT_NAME\"/"
      sed -i "$INSTALL_SHORT_NAME_EXPR" "$NAME"overrides.yaml
      yq m -x -i k8s.yaml -d "$i" "$NAME"overrides.yaml
   fi

   # overrides for ws-manager-bridge configmap
   if [[ "ws-manager-bridge-config" == "$NAME" ]] && [[ "$KIND" == "ConfigMap" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      touch "$NAME"overrides.yaml
      yq r k8s.yaml -d "$i" data | yq prefix - data > "$NAME"overrides.yaml

      # simliar to server, except the ConfigMap hierarchy, key, and value are different
      SHORT_NAME=$(yq r ./.werft/values.dev.yaml installation.shortname)
      INSTALL_SHORT_NAME_EXPR="s/\"installation\": \"\"/\"installation\": \"$SHORT_NAME\"/"
      sed -i "$INSTALL_SHORT_NAME_EXPR" "$NAME"overrides.yaml
      yq m -x -i k8s.yaml -d "$i" "$NAME"overrides.yaml
   fi

   i=$((i + 1))
done

exit
