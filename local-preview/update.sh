#!/usr/bin/env bash

leeway run dev/preview:build

if [[ "${VERSION:-}" == "" ]]; then
  if [[ ! -f  /tmp/local-dev-version ]]; then
    echo "VERSION is not set and no fallback version exists in /tmp/local-dev-version."
    echo "Please run leeway run dev/preview:build or set VERSION"
    exit 1
  fi
  VERSION="$(cat /tmp/local-dev-version)"
  echo "VERSION is not set - using value from /tmp/local-dev-version which is $VERSION"
fi

INSTALLER_CONFIG_PATH="${INSTALLER_CONFIG_PATH:-$(mktemp "/tmp/XXXXXX.gitpod.config.yaml")}"

# 1. Read versions from the file system. We rely on `leeway dev/preview:deploy-dependencies` to create this file for us
# Or from the docker file if it doesn't exist
# Or just build it and get it from there
if ! test -f "/tmp/versions.yaml"; then
  ec=0
  docker run --rm "eu.gcr.io/gitpod-dev-artifact/build/versions:$VERSION" cat /versions.yaml > /tmp/versions.yaml || ec=$?
  if [[ ec -ne 0 ]];then
      VERSIONS_TMP_ZIP=$(mktemp "/tmp/XXXXXX.installer.tar.gz")
      leeway build components:all-docker \
                              --dont-test \
                              -Dversion="${VERSION}" \
                              --save "${VERSIONS_TMP_ZIP}"
      tar -xzvf "${VERSIONS_TMP_ZIP}" ./versions.yaml && sudo mv ./versions.yaml /tmp/versions.yaml
      rm "${VERSIONS_TMP_ZIP}"
  fi
fi

if ! command -v installer;then
    INSTALLER_TMP_ZIP=$(mktemp "/tmp/XXXXXX.installer.tar.gz")
    leeway build install/installer:raw-app --dont-test --save "${INSTALLER_TMP_ZIP}"
    tar -xzvf "${INSTALLER_TMP_ZIP}" ./installer && sudo mv ./installer /usr/local/bin/
    rm "${INSTALLER_TMP_ZIP}"
fi

kubectl delete -n job migrations || true
kubectl delete -n job spicedb-migrations || true
installer --debug-version-file="/tmp/versions.yaml" render --use-experimental-config | kubectl apply -f - --server-side --force-conflicts
