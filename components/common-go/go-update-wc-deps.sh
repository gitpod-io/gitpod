#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -eo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
cd "$DIR"/../..

# an array of commponents we'll update and test at the end
COMPONENTS_TO_TEST=( )

# an associative array to describe dependencies we'd like to search for and update to
declare -A WORKSPACE_CLUSTER_DEPENDENCIES
# Reasoning on the specific versions: https://linear.app/gitpod/issue/CLC-982/update-containerd-to-latest-patch-16x-k8s-and-runc-libs-in-gitpod-mono#comment-d5450e2c
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/containerd/containerd"]="1.6.36"
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/moby/buildkit"]="0.12.5"
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/opencontainers/runc"]="1.1.14"
# Reasoning for this version: https://pkg.go.dev/sigs.k8s.io/controller-runtime#section-readme
WORKSPACE_CLUSTER_DEPENDENCIES["sigs.k8s.io/controller-runtime"]="0.18.7"
# Prefix matches
WORKSPACE_CLUSTER_DEPENDENCIES["k8s.io/"]="0.30.9"

# loop through keys of each associative array
for key in "${!WORKSPACE_CLUSTER_DEPENDENCIES[@]}"
do
    echo "Inspecting ${key}"
    # make an array of go.mod from components containing the dependency
    RELATED_COMPONENTS=( )
    mapfile -t "RELATED_COMPONENTS" < <(grep -r "${key}" --include="go.mod" -l)

    # update the dependency in each component
    for c in "${RELATED_COMPONENTS[@]}"
    do
        echo "On component ${c}"
        FOLDER="$(dirname "${c}")"
        pushd "${FOLDER}"

        # list all package to update, in case "key" is a prefix
        PACKAGES=$(grep -o "[[:space:]]${key}[^ ]*" go.mod | tr -d "[:blank:]" | sort | uniq)
        for p in ${PACKAGES}; do
            if [[ "$p" == k8s.io/klog* ]] || [[ "$p" == k8s.io/utils* ]] || [[ "$p" == k8s.io/kube-openapi* ]]  || [[ "$p" == k8s.io/gengo* ]]; then
                # special case imported indirectly, we don't want to update these. Also, they have different versions.
                echo "Ignoring ${p}..."
                continue
            fi

            if  grep -q "${p}" go.mod && ! grep -q "${p} v${WORKSPACE_CLUSTER_DEPENDENCIES[${key}]}" go.mod; then
                go get "${p}"@v"${WORKSPACE_CLUSTER_DEPENDENCIES[${key}]}"
                # shellcheck disable=SC2076
                if [[ ! " ${COMPONENTS_TO_TEST[*]} " =~ " ${FOLDER} " ]]; then
                    COMPONENTS_TO_TEST+=("${FOLDER}")
                fi
            fi
        done

        popd
    done
done

echo ""
echo "========== Done updating, doing tidy and testing now =========="
echo ""

# Cleanup installer separately because it depends on all other packages
# Doing "go mod tidy" in this order avoids package resolution confusion
INSTALLER_PACKAGE=""

for t in "${COMPONENTS_TO_TEST[@]}"
do
    if [[ "${t}" == "*install/installer" ]]; then
        # do after all others, as it's depending on all other packages
        INSTALLER_PACKAGE="${t}"
        continue
    fi

    pushd "${t}"
    # clean it up
    go mod tidy
    # assert that build and tests pass


    if [[ "${t}" == "test" ]]; then
        echo "Skipping tests for ${t}"
    else
        go test ./...
    fi
    popd
done

if [[ -n "${INSTALLER_PACKAGE}" ]]; then
    pushd "${INSTALLER_PACKAGE}"
    # clean it up
    go mod tidy
    # assert that build and tests pass
    go test ./...
    popd
fi
