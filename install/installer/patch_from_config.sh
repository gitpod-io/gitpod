#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


echo "Gitpod: Inject the Replicated variables into the config"
yq e -i '.domain = "{{repl ConfigOption "domain" }}"' "${CONFIG_FILE}"
yq e -i '.license.kind = "secret"' "${CONFIG_FILE}"
yq e -i '.license.name = "gitpod-license"' "${CONFIG_FILE}"

if [ '{{repl ConfigOptionNotEquals "openVsxUrl" "" }}' = "true" ];
then
  echo "Gitpod: Setting Open VSX Registry URL"
  yq e -i ".openVSX.url = \"{{repl ConfigOption "openVsxUrl" }}\"" "${CONFIG_FILE}"
fi

if [ '{{repl and (ConfigOptionEquals "db_incluster" "0") (ConfigOptionEquals "db_cloudsql_enabled" "1") }}' = "true" ];
then
  echo "Gitpod: configuring CloudSQLProxy"

  yq e -i ".database.inCluster = false" "${CONFIG_FILE}"
  yq e -i ".database.cloudSQL.instance = \"{{repl ConfigOption "db_cloudsql_instance" }}\"" "${CONFIG_FILE}"
  yq e -i ".database.cloudSQL.serviceAccount.kind = \"secret\"" "${CONFIG_FILE}"
  yq e -i ".database.cloudSQL.serviceAccount.name = \"cloudsql\"" "${CONFIG_FILE}"
fi

if [ '{{repl and (ConfigOptionEquals "db_incluster" "0") (ConfigOptionEquals "db_cloudsql_enabled" "0") }}' = "true" ];
then
  echo "Gitpod: configuring external database"

  yq e -i ".database.inCluster = false" "${CONFIG_FILE}"
  yq e -i ".database.external.certificate.kind = \"secret\"" "${CONFIG_FILE}"
  yq e -i ".database.external.certificate.name = \"database\"" "${CONFIG_FILE}"
fi

if [ '{{repl HasLocalRegistry }}' = "true" ];
then
  echo "Gitpod: configuring mirrored container registry for airgapped installation"

  yq e -i ".repository = \"{{repl LocalRegistryAddress }}\"" "${CONFIG_FILE}"
  yq e -i ".imagePullSecrets[0].kind = \"secret\"" "${CONFIG_FILE}"
  yq e -i ".imagePullSecrets[0].name = \"{{repl ImagePullSecretName }}\"" "${CONFIG_FILE}"
  yq e -i '.dropImageRepo = true' "${CONFIG_FILE}"

  # Add the registry to the server allowlist - keep docker.io in case it's just using the mirrored registry functionality without being airgapped
  yq e -i ".containerRegistry.privateBaseImageAllowList += \"{{repl LocalRegistryHost }}\"" "${CONFIG_FILE}"
  yq e -i ".containerRegistry.privateBaseImageAllowList += \"docker.io\"" "${CONFIG_FILE}"
fi

# Output the local registry secret - this is proxy.replicated.com if user hasn't set their own
echo "{{repl LocalRegistryImagePullSecret }}" | base64 -d > /tmp/kotsregistry.json

if [ '{{repl ConfigOptionEquals "reg_incluster" "0" }}' = "true" ];
then
  echo "Gitpod: configuring external container registry"

  # Create a container-registry secret merging the external registry and KOTS registry keys
  echo '{{repl printf "{\"auths\": {\"%s\": {\"username\": \"%s\", \"password\": %s, \"auth\": \"%s\"}}}" (ConfigOption "reg_server" | default (ConfigOption "reg_url")) (ConfigOption "reg_username") (ConfigOption "reg_password" | toJson) (printf "%s:%s" (ConfigOption "reg_username") (ConfigOption "reg_password") | Base64Encode) }}' \
    | yq -o=json '.' - \
    > /tmp/gitpodregistry.json

  cat /tmp/kotsregistry.json /tmp/gitpodregistry.json | jq -s '.[0] * .[1]' - - > /tmp/container-registry-secret

  echo "Gitpod: create the container-registry secret"
  yq e -i ".containerRegistry.inCluster = false" "${CONFIG_FILE}"
  yq e -i ".containerRegistry.external.url = \"{{repl ConfigOption "reg_url" }}\"" "${CONFIG_FILE}"
  yq e -i ".containerRegistry.external.certificate.kind = \"secret\"" "${CONFIG_FILE}"
  yq e -i ".containerRegistry.external.certificate.name = \"container-registry\"" "${CONFIG_FILE}"
else
  if [ '{{repl ConfigOptionEquals "reg_incluster_storage" "s3" }}' = "true" ];
  then
    echo "Gitpod: configuring container registry S3 backend"

    yq e -i ".containerRegistry.s3storage.region = \"{{repl ConfigOption "reg_incluster_storage_s3_region" }}\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.s3storage.endpoint = \"{{repl ConfigOption "reg_incluster_storage_s3_endpoint" }}\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.s3storage.bucket = \"{{repl ConfigOption "reg_incluster_storage_s3_bucketname" }}\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.s3storage.certificate.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".containerRegistry.s3storage.certificate.name = \"container-registry-s3-backend\"" "${CONFIG_FILE}"
  fi
fi

if [ '{{repl ConfigOptionNotEquals "store_provider" "incluster" }}' = "true" ];
then
  echo "Gitpod: configuring the storage"

  yq e -i ".metadata.region = \"{{repl ConfigOption "store_region" }}\"" "${CONFIG_FILE}"
  yq e -i ".objectStorage.inCluster = false" "${CONFIG_FILE}"

  if [ '{{repl ConfigOptionEquals "store_provider" "azure" }}' = "true" ];
  then
    echo "Gitpod: configuring storage for Azure"

    yq e -i ".objectStorage.azure.credentials.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.azure.credentials.name = \"storage-azure\"" "${CONFIG_FILE}"
  fi

  if [ '{{repl ConfigOptionEquals "store_provider" "gcp" }}' = "true" ];
  then
    echo "Gitpod: configuring storage for GCP"

    yq e -i ".objectStorage.cloudStorage.project = \"{{repl ConfigOption "store_gcp_project" }}\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.cloudStorage.serviceAccount.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.cloudStorage.serviceAccount.name = \"storage-gcp\"" "${CONFIG_FILE}"
  fi

  if [ '{{repl ConfigOptionEquals "store_provider" "s3" }}' = "true" ];
  then
    echo "Gitpod: configuring storage for S3"

    yq e -i ".objectStorage.s3.endpoint = \"{{repl ConfigOption "store_s3_endpoint" }}\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.s3.bucket = \"{{repl ConfigOption "store_s3_bucket" }}\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.s3.credentials.kind = \"secret\"" "${CONFIG_FILE}"
    yq e -i ".objectStorage.s3.credentials.name = \"storage-s3\"" "${CONFIG_FILE}"
  fi
fi

if [ '{{repl ConfigOptionEquals "ssh_gateway" "1" }}' = "true" ];
then
  echo "Gitpod: Generate SSH host key"
  ssh-keygen -t rsa -q -N "" -f host.key
  yq e -i '.sshGatewayHostKey.kind = "secret"' "${CONFIG_FILE}"
  yq e -i '.sshGatewayHostKey.name = "ssh-gateway-host-key"' "${CONFIG_FILE}"
fi

if [ '{{repl ConfigOptionEquals "tls_self_signed_enabled" "1" }}' = "true" ];
then
  echo "Gitpod: Generating a self-signed certificate with the internal CA"
  yq e -i '.customCACert.kind = "secret"' "${CONFIG_FILE}"
  yq e -i '.customCACert.name = "ca-issuer-ca"' "${CONFIG_FILE}"
elif [ '{{repl and (ConfigOptionEquals "tls_self_signed_enabled" "0") (ConfigOptionEquals "cert_manager_enabled" "0") (ConfigOptionNotEquals "tls_ca_crt" "") }}' = "true" ];
then
  echo "Gitpod: Setting CA to be used for certificate"
  yq e -i '.customCACert.kind = "secret"' "${CONFIG_FILE}"
  yq e -i '.customCACert.name = "ca-certificate"' "${CONFIG_FILE}"
fi

if [ '{{repl ConfigOptionEquals "user_management_block_enabled" "1" }}' = "true" ];
then
  echo "Gitpod: Adding blockNewUsers to config"
  yq e -i '.blockNewUsers.enabled = true' "${CONFIG_FILE}"

  for domain in {{repl ConfigOption "user_management_block_passlist" }}
  do
    echo "Gitpod: Adding domain \"${domain}\" to blockNewUsers config"
    yq e -i ".blockNewUsers.passlist += \"${domain}\"" "${CONFIG_FILE}"
  done
fi

if [ '{{repl ConfigOptionEquals "advanced_mode_enabled" "1" }}' = "true" ];
then
  echo "Gitpod: Applying advanced configuration"

  if [ '{{repl ConfigOptionNotEquals "component_proxy_service_serviceType" "" }}' = "true" ];
  then
    # Empty string defaults to LoadBalancer. This maintains backwards compatibility with the deprecated experimental value
    echo "Gitpod: Applying Proxy service type"
    yq e -i ".components.proxy.service.serviceType = \"{{repl ConfigOption "component_proxy_service_serviceType" }}\"" "${CONFIG_FILE}"
  fi

  if [ '{{repl ConfigOptionNotEquals "customization_patch" "" }}' = "true" ];
  then
    CUSTOMIZATION='{{repl ConfigOptionData "customization_patch" | Base64Encode }}'
    echo "Gitpod: Applying customization patch ${CUSTOMIZATION}"

    # Apply the customization property - if something else is set, this will be ignored
    yq e -i ".customization = $(echo "${CUSTOMIZATION}" | base64 -d | yq e -o json '.customization' - | jq -rc) // []" "${CONFIG_FILE}"
  fi

  if [ '{{repl ConfigOptionNotEquals "config_patch" "" }}' = "true" ];
  then
    echo "Gitpod: Patch Gitpod config"
    export CONFIG_PATCH_FILE="./config_patch.yaml"
    config_patch='{{repl ConfigOptionData "config_patch" | Base64Encode }}'
    (echo "${config_patch}" | base64 -d) > $CONFIG_PATCH_FILE
    yq eval-all --inplace 'select(fileIndex == 0) * select(fileIndex == 1)' "${CONFIG_FILE}" "${CONFIG_PATCH_FILE}"
  fi
else
  echo "Gitpod: No advanced configuration applied"
fi

echo "Gitpod: Update platform telemetry value"
yq eval-all --inplace '.experimental.telemetry.data.platform = "{{repl Distribution }}"' "${CONFIG_FILE}"
