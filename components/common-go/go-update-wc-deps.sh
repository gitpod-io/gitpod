#!/bin/bash
# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -eo pipefail

cd ../..

# an array of commponents we'll update and test at the end
COMPONENTS_TO_TEST=( )

# an associative array to describe dependencies we'd like to search for and update to
declare -A WORKSPACE_CLUSTER_DEPENDENCIES
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/containerd/containerd"]="1.6.18"
WORKSPACE_CLUSTER_DEPENDENCIES["github.com/moby/buildkit"]="0.11.3"

# loop through keys of each associative array
for key in "${!WORKSPACE_CLUSTER_DEPENDENCIES[@]}"
do
    echo "Working on ${key}"
    # make an array of go.mod from components containing the dependency
    RELATED_COMPONENTS=( )
    mapfile -t "RELATED_COMPONENTS" < <(grep -r "${key}" --include="go.mod" -l)

    # update the dependency in each component
    for c in "${RELATED_COMPONENTS[@]}"
    do
        echo "Working on ${c}"
        FOLDER="$(dirname "${c}")"
        pushd "${FOLDER}"
        echo "${key}"
        go get "${key}"@v"${WORKSPACE_CLUSTER_DEPENDENCIES[${key}]}"
         # shellcheck disable=SC2076
        if [[ ! " ${COMPONENTS_TO_TEST[*]} " =~ " ${FOLDER} " ]]; then
            COMPONENTS_TO_TEST+=("${FOLDER}")
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
