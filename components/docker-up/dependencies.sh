#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -euo pipefail

DOCKER_VERSION=19.03.15
DOCKER_COMPOSE_VERSION=2.2.3
SLIRP4NETNS_VERSION=v1.1.12

curl -o docker.tgz      -fsSL https://download.docker.com/linux/static/stable/$(uname -m)/docker-${DOCKER_VERSION}.tgz
curl -o docker-compose  -fsSL https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-linux-$(uname -m)
curl -o slirp4netns     -fsSL https://github.com/rootless-containers/slirp4netns/releases/download/${SLIRP4NETNS_VERSION}/slirp4netns-$(uname -m)
