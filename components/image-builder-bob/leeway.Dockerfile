# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM moby/buildkit:v0.9.0

USER root
RUN apk --no-cache add sudo bash \
    && addgroup -g 33333 gitpod \
    && adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod \
    && echo "gitpod ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/gitpod \
    && chmod 0440 /etc/sudoers.d/gitpod

COPY components-image-builder-bob--app/bob /app/
RUN chmod 4755 /app/bob

COPY components-image-builder-mk3-workspace-image-layer--pack/pack.tar /app/workspace-image-layer.tar.gz
RUN mkdir /app/gplayer \
    && cd /app/gplayer \
    && tar xzf /app/workspace-image-layer.tar.gz \
    && rm -r /app/workspace-image-layer.tar.gz \
    && mv gitpod-layer/* .

RUN mkdir /ide
COPY ide-startup.sh /ide/startup.sh
COPY supervisor-ide-config.json /ide/

# sudo buildctl-daemonless.sh
ENTRYPOINT [ "/app/bob" ]
CMD [ "build" ]