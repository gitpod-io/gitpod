# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM ghcr.io/gitpod-io/buildkit:v0.34.0-gitpod.1@sha256:dbe25ae89df951659bbb996465754eba57281de9a99bdf1e27216c89098eee55

USER root
RUN apk upgrade --no-cache brotli-libs curl libcurl libssl3 libcrypto3 \
    && apk upgrade --no-cache \
    && apk --no-cache add sudo bash \
    && addgroup -g 33333 gitpod \
    && adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod \
    && echo "gitpod ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/gitpod \
    && chmod 0440 /etc/sudoers.d/gitpod

COPY components-image-builder-bob--runc-facade/bob /app/runc-facade
RUN chmod 4755 /app/runc-facade \
    && mv /usr/bin/buildkit-runc /usr/bin/bob-runc \
    && mv /app/runc-facade /usr/bin/buildkit-runc

COPY components-image-builder-bob--app/bob /app/
RUN chmod 4755 /app/bob

RUN mkdir /ide
COPY ide-startup.sh /ide/startup.sh
COPY supervisor-ide-config.json /ide/

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
# sudo buildctl-daemonless.sh
ENTRYPOINT [ "/app/bob" ]
CMD [ "build" ]
