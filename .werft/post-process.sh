#!/bin/bash

# to test, follow these steps
# 1. generate a config like so: ./installer init > config.yaml
# 2. generate a k8s manifest like so: ./installer render -n $(kubens -c) -c config.yaml > k8s.yaml
# 3. call this script like so: ./.werft/post-process.sh 1234 5678 2 branch-name-dashes-only

set -e

REG_DAEMON_PORT=$1
WS_DAEMON_PORT=$2
NODE_POOL_INDEX=$3
DEV_BRANCH=$4

if [[ -z ${REG_DAEMON_PORT} ]] || [[ -z ${WS_DAEMON_PORT} ]] || [[ -z ${NODE_POOL_INDEX} ]] || [[ -z ${DEV_BRANCH} ]]; then
   echo "One or more input params were invalid: ${REG_DAEMON_PORT} ${WS_DAEMON_PORT} ${NODE_POOL_INDEX} ${DEV_BRANCH}"
   exit 1
fi

i=0

# count YAML like lines in the k8s manifest file
MATCHES="$(grep -c -- --- k8s.yaml)"
# get the read number of K8s manifest docs
# K8s object names and kinds are duplicated in a config map to faciliate deletion
# subtract one (the config map) and then divide by 2 to get the actual # of docs we'll loop through
DOCS="$(((MATCHES - 1) / 2))"

echo "Use node pool index $NODE_POOL_INDEX"

while [ "$i" -le "$DOCS" ]; do
   # override daemon sets which bind to an actual node port via the hostPort setting on the pod
   unset PORT SIZE NAME UNSET
   PORT=$(yq r k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].hostPort)
   SIZE="${#PORT}"
   NAME=$(yq r k8s.yaml -d "$i" metadata.name)
   KIND=$(yq r k8s.yaml -d "$i" kind)
   if [[ "$SIZE" -ne "0" ]] && [[ "$NAME" == "registry-facade" ]] && [[ "$KIND" == "DaemonSet" ]] ; then
      echo "setting $NAME to $REG_DAEMON_PORT"
      yq w -i k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].hostPort "$REG_DAEMON_PORT"
   fi
   if [[ "$SIZE" -ne "0" ]] && [[ "$NAME" == "ws-daemon" ]] && [[ "$KIND" == "DaemonSet" ]] ; then
      echo "setting $NAME to $WS_DAEMON_PORT"
      yq w -i k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].hostPort "$WS_DAEMON_PORT"
      yq w -i k8s.yaml -d "$i" spec.template.spec.containers.[0].ports.[0].containerPort "$WS_DAEMON_PORT"
   fi

   # override details for registry-facade service
   if [[ "registry-facade" == "$NAME" ]] && [[ "$KIND" == "Service" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      yq w -i k8s.yaml -d "$i" spec.ports[0].port "$REG_DAEMON_PORT"
   fi

   # override labels for pod scheduling on nodes
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
      NAMESPACE=$(kubens -c)
      INSTALL_SHORT_NAME_EXPR="s/\"installationShortname\": \"$NAMESPACE\"/\"installationShortname\": \"$SHORT_NAME\"/"
      sed -i "$INSTALL_SHORT_NAME_EXPR" "$NAME"overrides.yaml
      # Stage
      STAGE=$(yq r ./.werft/values.dev.yaml installation.stage)
      STAGE_EXPR="s/\"stage\": \"production\"/\"stage\": \"$STAGE\"/"
      sed -i "$STAGE_EXPR" "$NAME"overrides.yaml
      # Merge the changes
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

   # override details for Minio
   if [[ "minio" == "$NAME" ]] && [[ "$KIND" == "Deployment" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      yq -d "$i" w -i k8s.yaml spec.template.spec.serviceAccountName ws-daemon
   fi

   # overrides for ws-manager
   if [[ "ws-manager" == "$NAME" ]] && [[ "$KIND" == "ConfigMap" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      touch "$NAME"overrides.yaml
      yq r k8s.yaml -d "$i" data | yq prefix - data > "$NAME"overrides.yaml

      SHORT_NAME=$(yq r ./.werft/values.dev.yaml installation.shortname)
      STAGING_HOST_NAME=$(yq r ./.werft/values.dev.yaml hostname)
      CURRENT_WS_HOST_NAME="ws.$DEV_BRANCH.$STAGING_HOST_NAME"
      NEW_WS_HOST_NAME="ws-$SHORT_NAME.$DEV_BRANCH.$STAGING_HOST_NAME"

      WS_CLUSTER_HOST_EXPR="s/\"workspaceClusterHost\": \"$CURRENT_WS_HOST_NAME\"/\"workspaceClusterHost\": \"$NEW_WS_HOST_NAME\"/"
      sed -i "$WS_CLUSTER_HOST_EXPR" "$NAME"overrides.yaml

      WS_PORT_URL_TEMP_EXPR="s|\"portUrlTemplate\": \"https://{{ .WorkspacePort }}-{{ .Prefix }}.$CURRENT_WS_HOST_NAME\"|\"portUrlTemplate\": \"https://{{ .WorkspacePort }}-{{ .Prefix }}.$NEW_WS_HOST_NAME\"|"
      sed -i "$WS_PORT_URL_TEMP_EXPR" "$NAME"overrides.yaml

      WS_URL_TEMP_EXPR="s|\"urlTemplate\": \"https://{{ .Prefix }}.$CURRENT_WS_HOST_NAME\"|\"urlTemplate\": \"https://{{ .Prefix }}.$NEW_WS_HOST_NAME\"|"
      sed -i "$WS_URL_TEMP_EXPR" "$NAME"overrides.yaml

      # Change the port we use to connect to registry-facade
      sed -i -e "/registryFacadeHost/s/3000/$REG_DAEMON_PORT/g" "$NAME"overrides.yaml
      # Change the port we use to connect to ws-daemon
      # get the json string and parse it
      yq r "$NAME"overrides.yaml 'data.[config.json]' \
      | jq ".manager.wsdaemon.port = $WS_DAEMON_PORT" > "$NAME"-cm-overrides.json
      touch "$NAME"-cm-overrides.yaml
      # write a yaml file with the json as a multiline string
      yq w -i "$NAME"-cm-overrides.yaml "data.[config.json]" -- "$(< "$NAME"-cm-overrides.json)"
      yq m -x -i "$NAME"overrides.yaml "$NAME"-cm-overrides.yaml

      yq m -x -i k8s.yaml -d "$i" "$NAME"overrides.yaml
   fi

   # overrides for ws-proxy
   if [[ "ws-proxy" == "$NAME" ]] && [[ "$KIND" == "ConfigMap" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      touch "$NAME"overrides.yaml
      yq r k8s.yaml -d "$i" data | yq prefix - data > "$NAME"overrides.yaml

      # simliar to server, except the ConfigMap hierarchy, key, and value are different
      SHORT_NAME=$(yq r ./.werft/values.dev.yaml installation.shortname)
      STAGING_HOST_NAME=$(yq r ./.werft/values.dev.yaml hostname)
      CURRENT_WS_HOST_NAME="ws.$DEV_BRANCH.$STAGING_HOST_NAME"
      NEW_WS_HOST_NAME="ws-$SHORT_NAME.$DEV_BRANCH.$STAGING_HOST_NAME"

      WS_HOST_SUFFIX_EXPR="s/\"workspaceHostSuffix\": \".$CURRENT_WS_HOST_NAME\"/\"workspaceHostSuffix\": \".$NEW_WS_HOST_NAME\"/"
      sed -i "$WS_HOST_SUFFIX_EXPR" "$NAME"overrides.yaml

      CURRENT_WS_SUFFIX_REGEX=$DEV_BRANCH.$STAGING_HOST_NAME
      # In this, we only do a find replace on a given line if we find workspaceHostSuffixRegex on the line
      sed -i -e "/workspaceHostSuffixRegex/s/$CURRENT_WS_SUFFIX_REGEX/$DEV_BRANCH\\\\\\\\.staging\\\\\\\\.gitpod-dev\\\\\\\\.com/g" "$NAME"overrides.yaml

      yq m -x -i k8s.yaml -d "$i" "$NAME"overrides.yaml
   fi

   # update workspace-templates configmap to set affinity for workspace, ghosts, image builders, etc.
   # if this is not done, and they start on a node other than workspace, they won't be able to talk to registry-facade or ws-daemon
   if [[ "workspace-templates" == "$NAME" ]] && [[ "$KIND" == "ConfigMap" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      touch "$NAME"overrides.yaml

      # get the data to modify
      yq r k8s.yaml -d "$i" 'data.[default.yaml]' > "$NAME"overrides.yaml

      # add the proper affinity
      LABEL="gitpod.io/workspace_$NODE_POOL_INDEX"
      yq w -i "$NAME"overrides.yaml spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key "$LABEL"
      yq w -i "$NAME"overrides.yaml spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].operator Exists

      yq w -i k8s.yaml -d "$i" "data.[default.yaml]" -- "$(< "$NAME"overrides.yaml)"
   fi

   # NetworkPolicy for ws-daemon
   if [[ "ws-daemon" == "$NAME" ]] && [[ "$KIND" == "NetworkPolicy" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      yq w -i k8s.yaml -d "$i" spec.ingress[0].ports[0].port "$WS_DAEMON_PORT"
   fi

   # host ws-daemon on $WS_DAEMON_PORT
   if [[ "ws-daemon" == "$NAME" ]] && [[ "$KIND" == "ConfigMap" ]]; then
      WORK="overrides for $NAME $KIND"
      echo "$WORK"
      # Get a copy of the config we're working with
      yq r k8s.yaml -d "$i" > "$NAME"-"$KIND"-overrides.yaml
      # Parse and update the JSON, and write it to a file
      yq r "$NAME"-"$KIND"-overrides.yaml 'data.[config.json]' \
      | jq ".service.address = $WS_DAEMON_PORT" > "$NAME"-"$KIND"-overrides.json
      # Give the port a colon prefix, ("5678" to ":5678")
      # jq would not have it, hence the usage of sed to do the transformation
      PORT_NUM_FORMAT_EXPR="s/\"address\": $WS_DAEMON_PORT/\"address\": \":$WS_DAEMON_PORT\"/"
      sed -i "$PORT_NUM_FORMAT_EXPR" "$NAME"-"$KIND"-overrides.json
      # write a yaml file with new json as a multiline string
      touch "$NAME"-"$KIND"-data-overrides.yaml
      yq w -i "$NAME"-"$KIND"-data-overrides.yaml "data.[config.json]" -- "$(< "$NAME"-"$KIND"-overrides.json)"
      # merge the updated data object with existing config
      yq m -x -i "$NAME"-"$KIND"-overrides.yaml "$NAME"-"$KIND"-data-overrides.yaml
      # merge the updated config map with k8s.yaml
      yq m -x -i k8s.yaml -d "$i" "$NAME"-"$KIND"-overrides.yaml
   fi

   # TODO: list
   #  adding a license (Simon created #6868) - ADD THIS IN VIA POST PROCESSING
   #  intergrating with charge bees (get feedback from meta team) - WON'T FIX NOW
   #  Server feature flags (get feedback from meta team) - TRY ADDING IN AS POST PROCESSING

   i=$((i + 1))
done

exit
