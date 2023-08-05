# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:46d848cfc02366b9f44e8e9323935ecb349286bf8a047a9e83186d91a105fc3a as dl
WORKDIR /dl
RUN apk add --no-cache curl file \
  && curl -OsSL https://github.com/opencontainers/runc/releases/download/v1.1.7/runc.amd64 \
  && chmod +x runc.amd64 \
  && if ! file runc.amd64 | grep -iq "ELF 64-bit LSB executable"; then echo "runc.amd64 is not a binary file"; exit 1;fi

FROM ubuntu:22.04

# trigger manual rebuild increasing the value
ENV TRIGGER_REBUILD=1

## Installing coreutils is super important here as otherwise the loopback device creation fails!
ARG CLOUD_SDK_VERSION=437.0.1
ENV CLOUD_SDK_VERSION=$CLOUD_SDK_VERSION
ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1

# Install latest stable git version from PPA https://launchpad.net/~git-core/+archive/ubuntu/ppa
RUN apt update \
  && apt dist-upgrade -y \
  && apt install -yq --no-install-recommends \
      software-properties-common gnupg \
  && add-apt-repository ppa:git-core/ppa -y \
  && apt install -yq --no-install-recommends \
      git git-lfs openssh-client lz4 e2fsprogs coreutils tar strace xfsprogs curl ca-certificates \
      apt-transport-https \
      python3-crcmod \
      aria2 \
      lvm2 \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl -sSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
  && apt update && apt install -y --no-install-recommends  google-cloud-sdk=${CLOUD_SDK_VERSION}-0 \
  && gcloud config set core/disable_usage_reporting true \
  && gcloud config set component_manager/disable_update_check true \
  && gcloud config set metrics/environment github_docker_image \
  && gcloud --version \
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
