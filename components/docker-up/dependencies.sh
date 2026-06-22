#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

set -euo pipefail

RUNC_VERSION=v1.1.15
RUNC_VERSION_WITHOUT_V=${RUNC_VERSION#v}
output_dir=$(pwd)

cleanup() {
  rm -rf "${compose_dir:-}" "${runc_dir:-}"
}
trap cleanup EXIT

build_docker_compose() {
  compose_dir=$(mktemp -d)
  curl -fsSL "https://github.com/docker/compose/archive/refs/tags/v${DOCKER_COMPOSE_VERSION}.tar.gz" \
    | tar -xz --strip-components=1 -C "${compose_dir}"

  (
    cd "${compose_dir}"
    go mod edit \
      -require=golang.org/x/crypto@v0.52.0 \
      -require=golang.org/x/net@v0.55.0 \
      -require=google.golang.org/grpc@v1.79.3
    go mod tidy
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
      -trimpath \
      -ldflags="-s -w -X github.com/docker/compose/v2/internal.Version=v${DOCKER_COMPOSE_VERSION}" \
      -o "${output_dir}/docker-compose" \
      ./cmd
  )
}

build_runc() {
  runc_dir=$(mktemp -d)
  curl -fsSL "https://github.com/opencontainers/runc/archive/refs/tags/${RUNC_VERSION}.tar.gz" \
    | tar -xz --strip-components=1 -C "${runc_dir}"

  (
    cd "${runc_dir}"
    go mod edit -require=golang.org/x/net@v0.55.0
    go mod tidy
    CGO_ENABLED=1 GOFLAGS=-mod=mod GOOS=linux GOARCH=amd64 go build \
      -trimpath \
      -tags seccomp \
      -ldflags="-s -w -X main.version=${RUNC_VERSION_WITHOUT_V}" \
      -o "${output_dir}/runc" \
      .
  )
}

# DOCKER_VERSION and DOCKER_COMPOSE_VERSION are defined in WORKSPACE.yaml
curl -o docker.tgz      -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz"

build_docker_compose
build_runc

sha256sum docker-compose | sed 's/docker-compose$/docker-compose-linux-x86_64/' > checksums.txt
