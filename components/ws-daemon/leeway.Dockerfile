# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM golang:1.25-bookworm AS tool-builder

ARG RUNC_VERSION=v1.2.9
ARG GIT_LFS_VERSION=v3.7.1

WORKDIR /build
RUN apt-get update \
  && apt-get install -yq --no-install-recommends ca-certificates curl file gcc libc6-dev libseccomp-dev \
  && rm -rf /var/lib/apt/lists/*

# Build runc locally instead of consuming the upstream release binary because
# the current upstream v1.2.9 asset was built with vulnerable Go dependencies.
# Keep this on the v1.2.x line for compatibility and switch back to upstream
# once an upstream asset scans clean with the required fixed modules.
RUN set -eux; \
  runc_version_without_v="${RUNC_VERSION#v}"; \
  mkdir -p /build/runc; \
  curl -fsSL "https://github.com/opencontainers/runc/archive/refs/tags/${RUNC_VERSION}.tar.gz" \
    | tar -xz --strip-components=1 -C /build/runc; \
  cd /build/runc; \
  go mod edit -require=golang.org/x/net@v0.55.0; \
  go mod tidy; \
  CGO_ENABLED=1 GOFLAGS=-mod=mod GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -tags seccomp \
    -ldflags="-s -w -X main.version=${runc_version_without_v}" \
    -o /out/runc \
    .; \
  chmod +x /out/runc; \
  /out/runc --version; \
  if ! file /out/runc | grep -iq "ELF 64-bit LSB executable\\|ELF 64-bit LSB pie executable"; then echo "runc is not a binary file"; exit 1; fi

# Build Git LFS locally instead of installing the Ubuntu package or consuming
# the upstream release binary because the available artifacts still scan with
# critical Go stdlib/x/crypto/x/net findings. Switch back to distro/upstream
# once those artifacts are rebuilt with fixed dependencies.
RUN set -eux; \
  mkdir -p /build/git-lfs; \
  curl -fsSL "https://github.com/git-lfs/git-lfs/archive/refs/tags/${GIT_LFS_VERSION}.tar.gz" \
    | tar -xz --strip-components=1 -C /build/git-lfs; \
  cd /build/git-lfs; \
  go mod edit \
    -require=golang.org/x/crypto@v0.52.0 \
    -require=golang.org/x/net@v0.55.0; \
  go mod tidy; \
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w -X github.com/git-lfs/git-lfs/v3/config.GitCommit=gitpod-rebuild" \
    -o /out/git-lfs \
    ./git-lfs.go; \
  chmod +x /out/git-lfs; \
  /out/git-lfs version; \
  if ! file /out/git-lfs | grep -iq "ELF 64-bit LSB executable\\|ELF 64-bit LSB pie executable"; then echo "git-lfs is not a binary file"; exit 1; fi

FROM ubuntu:22.04

# trigger manual rebuild increasing the value
ENV TRIGGER_REBUILD=1

# Install latest stable git version from PPA https://launchpad.net/~git-core/+archive/ubuntu/ppa
RUN apt update \
  && apt dist-upgrade -y \
  && apt install -yq --no-install-recommends \
      software-properties-common gnupg \
  && add-apt-repository ppa:git-core/ppa -y \
  && apt install -yq --no-install-recommends \
      git openssh-client lz4 e2fsprogs coreutils tar strace xfsprogs curl ca-certificates \
      aria2 \
      lvm2 \
      nfs-common \
  && apt-get clean -y \
  && rm -rf \
    /var/cache/debconf/* \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*

COPY --from=tool-builder /out/runc /usr/bin/runc
COPY --from=tool-builder /out/git-lfs /usr/bin/git-lfs

# Add gitpod user for operations (e.g. checkout because of the post-checkout hook!)
RUN groupadd -r -g 33333 gitpod \
  && useradd -r -u 33333 -md /home/gitpod -s /bin/bash -g gitpod gitpod \
  && usermod -a -G gitpod gitpod

COPY components-ws-daemon--app/ws-daemon /app/ws-daemond
COPY components-ws-daemon--content-initializer/ws-daemon /app/content-initializer
COPY components-ws-daemon-nsinsider--app/nsinsider /app/nsinsider

COPY default.gitconfig /etc/gitconfig
COPY default.gitconfig /home/gitpod/.gitconfig

USER root

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/ws-daemond" ]
CMD [ "-v", "help" ]
