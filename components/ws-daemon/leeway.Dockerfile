# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:7d42186063e8ac6e84c6ecdadd27497545a6dedd9d985dc8a2e66cb6148c230e as dl
WORKDIR /dl
RUN apk add --no-cache curl file \
  && curl -OsSL https://github.com/opencontainers/runc/releases/download/v1.2.9/runc.amd64 \
  && chmod +x runc.amd64 \
  && if ! file runc.amd64 | grep -iq "ELF 64-bit LSB pie executable"; then echo "runc.amd64 is not a binary file"; exit 1;fi

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
      git git-lfs openssh-client lz4 e2fsprogs coreutils tar strace xfsprogs curl ca-certificates \
      aria2 \
      lvm2 \
      nfs-common \
  && apt-get clean -y \
  && rm -rf \
    /var/cache/debconf/* \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*

COPY --from=dl /dl/runc.amd64 /usr/bin/runc

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
