# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.16 as dl
WORKDIR /dl
RUN apk add --no-cache curl \
  && curl -OL https://github.com/opencontainers/runc/releases/download/v1.1.3/runc.amd64 \
  && chmod +x runc.amd64

FROM ubuntu:22.04

## Installing coreutils is super important here as otherwise the loopback device creation fails!
ARG CLOUD_SDK_VERSION=390.0.0
ENV CLOUD_SDK_VERSION=$CLOUD_SDK_VERSION
ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1

RUN apt update \
  && apt dist-upgrade -y \
  && apt install -yq --no-install-recommends \
      git git-lfs openssh-client lz4 e2fsprogs coreutils tar strace xfsprogs curl ca-certificates strace \
      apt-transport-https \
      python3-crcmod \
      gnupg \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl -sSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
  && apt update && apt install -y --no-install-recommends  google-cloud-sdk=${CLOUD_SDK_VERSION}-0 kubectl \
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

RUN cd /usr/bin \
  && curl -fsSL https://github.com/atkrad/wait4x/releases/download/v2.4.0/wait4x-linux-amd64.tar.gz | tar xzv --no-anchored wait4x

COPY --from=dl /dl/runc.amd64 /usr/bin/runc

# Add gitpod user for operations (e.g. checkout because of the post-checkout hook!)
RUN groupadd -r -g 33333 gitpod \
  && useradd -r -u 33333 -md /home/gitpod -s /bin/bash -g gitpod gitpod \
  && usermod -a -G gitpod gitpod

COPY components-ws-daemon--app/ws-daemon /app/ws-daemond
COPY components-ws-daemon--content-initializer/ws-daemon /app/content-initializer
COPY components-ws-daemon-nsinsider--app/nsinsider /app/nsinsider

USER root

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/ws-daemond" ]
CMD [ "-v", "help" ]
