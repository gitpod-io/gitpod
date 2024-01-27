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
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/containerd/containerd"]="1.7.11"
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/moby/buildkit"]="0.12.4"

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

        if  grep -q "${key}" go.mod && ! grep -q "${key} v${WORKSPACE_CLUSTER_DEPENDENCIES[${key}]}" go.mod; then
            go get "${key}"@v"${WORKSPACE_CLUSTER_DEPENDENCIES[${key}]}"
            # shellcheck disable=SC2076
            if [[ ! " ${COMPONENTS_TO_TEST[*]} " =~ " ${FOLDER} " ]]; then
                COMPONENTS_TO_TEST+=("${FOLDER}")
            fi
        fi

        popd
    done
done

for t in "${COMPONENTS_TO_TEST[@]}"
do
    pushd "${t}"
    # clean it up
    go mod tidy
    # assert that build and tests pass
    go test ./...
    popd
done
