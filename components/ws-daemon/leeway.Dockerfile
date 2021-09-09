# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.14 as dl
WORKDIR /dl
RUN apk add --no-cache curl \
  && curl -OL https://github.com/opencontainers/runc/releases/download/v1.0.1/runc.amd64 \
  && chmod +x runc.amd64

FROM alpine:3.14

RUN apk upgrade \
  && rm -rf /var/cache/apk/*

## Installing coreutils is super important here as otherwise the loopback device creation fails!
RUN apk add --no-cache git bash openssh-client lz4 e2fsprogs coreutils tar strace
COPY --from=dl /dl/runc.amd64 /usr/bin/runc

# Add gitpod user for operations (e.g. checkout because of the post-checkout hook!)
RUN addgroup -g 33333 gitpod \
    && adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod \
    && echo "gitpod:gitpod" | chpasswd

COPY components-ws-daemon--app/ws-daemon /app/ws-daemond
COPY components-ws-daemon--content-initializer/ws-daemon /app/content-initializer
COPY components-ws-daemon-nsinsider--app/nsinsider /app/nsinsider

USER root
ENTRYPOINT [ "/app/ws-daemond" ]
CMD [ "-v", "help" ]
