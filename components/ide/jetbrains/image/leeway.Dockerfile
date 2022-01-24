# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15 as download
ARG JETBRAINS_BACKEND_URL
WORKDIR /workdir
RUN apk add --no-cache --upgrade curl gzip tar unzip
RUN curl -sSLo backend.tar.gz "$JETBRAINS_BACKEND_URL" && tar -xf backend.tar.gz --strip-components=1 && rm backend.tar.gz
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin/build/distributions/gitpod-remote-0.0.1.zip /workdir
RUN unzip gitpod-remote-0.0.1.zip -d plugins/ && rm gitpod-remote-0.0.1.zip

FROM scratch
ARG SUPERVISOR_IDE_CONFIG
COPY --chown=33333:33333 ${SUPERVISOR_IDE_CONFIG} /ide-desktop/supervisor-ide-config.json
COPY --chown=33333:33333 startup.sh /ide-desktop/
COPY --chown=33333:33333 --from=download /workdir/ /ide-desktop/backend/
COPY --chown=33333:33333 components-ide-jetbrains-image-status--app/status /ide-desktop