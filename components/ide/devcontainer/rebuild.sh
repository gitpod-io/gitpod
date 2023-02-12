#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

component=${PWD##*/}

# build
go build .
yarn && yarn build
echo "$component: built"

cp supervisor-ide-runtime-config.json /ide/
rm /ide/devcontainer && true
ln -s "$(pwd)" /ide/devcontainer
echo "$component: linked in /ide"

gp rebuild --workspace-folder=/workspace/gitpod/components/ide/devcontainer/example/workspace --host-network "$@"
