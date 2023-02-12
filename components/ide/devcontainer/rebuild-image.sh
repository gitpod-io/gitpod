#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -Eeuo pipefail

leeway build .:docker -Dversion=test

rm -rf /workspace/rebuild && true
mkdir -p /workspace/rebuild
docker save eu.gcr.io/gitpod-core-dev/build/ide/devcontainer:test -o /workspace/rebuild/devcontainer.tar
tar -xvf /workspace/rebuild/devcontainer.tar -C /workspace/rebuild/
find /workspace/rebuild/ -name layer.tar -exec tar -xvf {} -C /workspace/rebuild/ \;

cp /workspace/rebuild/ide/supervisor-ide-runtime-config.json /ide/
rm /ide/devcontainer && true
ln -s /workspace/rebuild/ide/devcontainer /ide/devcontainer
echo "eu.gcr.io/gitpod-core-dev/build/ide/devcontainer:test: linked in /ide"

gp rebuild --workspace-folder=/workspace/gitpod/components/ide/devcontainer/example/workspace --host-network "$@"
