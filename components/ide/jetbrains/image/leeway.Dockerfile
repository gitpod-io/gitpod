# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM golang:1.17 AS build
WORKDIR /app
COPY status/* /app/
RUN go build -o status

FROM alpine:3.14 as download
ARG JETBRAINS_BACKEND_URL
WORKDIR /workdir
RUN apk add --no-cache --upgrade curl gzip tar unzip
RUN curl -sSLo backend.tar.gz "$JETBRAINS_BACKEND_URL" && tar -xf backend.tar.gz --strip-components=1 && rm backend.tar.gz
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin/build/distributions/jetbrains-backend-plugin-1.0-SNAPSHOT.zip /workdir
RUN unzip jetbrains-backend-plugin-1.0-SNAPSHOT.zip -d plugins/ && rm jetbrains-backend-plugin-1.0-SNAPSHOT.zip

FROM scratch
ARG SUPERVISOR_IDE_CONFIG
COPY --chown=33333:33333 ${SUPERVISOR_IDE_CONFIG} /ide-desktop/supervisor-ide-config.json
COPY --chown=33333:33333 startup.sh /ide-desktop/
COPY --chown=33333:33333 --from=build /app/status /ide-desktop/
COPY --chown=33333:33333 --from=download /workdir/ /ide-desktop/backend/
