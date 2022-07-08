#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


# based on https://github.com/kubernetes/kubernetes/issues/79384

VERSION=${1#"v"}
if [ -z "$VERSION" ]; then
    echo "usage: $0 <version>"
    echo
    echo "example: $0 15.0"
    echo "         $0 17.3"
    exit 1
fi

set -euo pipefail

echo "Retrieving kubernetes module file"
GM=$(go mod download -json k8s.io/kubernetes@v1."$VERSION" | jq -r .GoMod)
# shellcheck disable=SC2002,SC2207
MODS=($(cat "$GM" | grep -E "^\s+k8s.io/.*v0.0.0$" | tr -d '\t' | cut -d ' ' -f 1))

useSemver=$(echo "console.log(\"1.${VERSION}\" >= \"1.17\")" | node -)
if [ "$useSemver" = "true" ]; then
    echo "Version is newer than 1.17 - using semver"
fi

echo Adding "${MODS[@]}"
for MOD in "${MODS[@]}"; do
    if [ "$useSemver" = "true" ]; then
        V="v0.${VERSION}"
    else
        V=$(go mod download -json "${MOD}@kubernetes-1.${VERSION}" | jq -r .Version)
    fi
    go mod edit "-replace=${MOD}=${MOD}@${V}"
done

go install -v ./...
