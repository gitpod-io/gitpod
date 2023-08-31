# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM moby/buildkit:v0.12.2

USER root
RUN apk --no-cache add sudo bash tar wget \
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

ARG SOCI_SNAPSHOTTER_VERSION=0.4.0
RUN wget https://github.com/awslabs/soci-snapshotter/releases/download/v${SOCI_SNAPSHOTTER_VERSION}/soci-snapshotter-v${SOCI_SNAPSHOTTER_VERSION}-linux-amd64-static.tar.gz \
    && tar zxpvf soci-snapshotter-v${SOCI_SNAPSHOTTER_VERSION}-linux-amd64-static.tar.gz -C /usr/bin soci \
    && rm soci-snapshotter-v${SOCI_SNAPSHOTTER_VERSION}-linux-amd64-static.tar.gz

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
