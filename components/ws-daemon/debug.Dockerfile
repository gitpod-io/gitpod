# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/go:1.20 AS debugger
RUN apk add --no-cache git
RUN go get -u github.com/go-delve/delve/cmd/dlv

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:b78bb982194828b6c9c214230bf34d51944e2102ea8468f01ac21e5f99328efd as dl
WORKDIR /dl
RUN apk add --no-cache curl file \
  && curl -OsSL https://github.com/opencontainers/runc/releases/download/v1.1.14/runc.amd64 \
  && chmod +x runc.amd64 \
  && if ! file runc.amd64 | grep -iq "ELF 64-bit LSB pie executable"; then echo "runc.amd64 is not a binary file"; exit 1;fi

FROM ubuntu:22.10

# trigger manual rebuild increasing the value
ENV TRIGGER_REBUILD=1

RUN apt update \
  && apt dist-upgrade -y \
  && apt install -yq --no-install-recommends \
      git git-lfs openssh-client lz4 e2fsprogs coreutils tar strace xfsprogs curl ca-certificates \
      gnupg \
      aria2 \
      lvm2 \
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

COPY --from=debugger /go/bin/dlv /usr/bin
COPY ws-daemond /app/ws-daemond
ENTRYPOINT [ "/app/ws-daemond" ]
CMD [ "-v", "help" ]
