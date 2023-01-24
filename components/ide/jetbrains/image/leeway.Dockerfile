# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM alpine:3.16 as base_builder
RUN mkdir /ide-desktop

# for debugging
# FROM alpine:3.16
FROM scratch
ARG JETBRAINS_DOWNLOAD_QUALIFIER
ARG JETBRAINS_BACKEND_QUALIFIER
ARG JETBRAINS_BACKEND_VERSION
ARG SUPERVISOR_IDE_CONFIG
# ensures right permissions for /ide-desktop
COPY --from=base_builder --chown=33333:33333 /ide-desktop/ /ide-desktop/
COPY --chown=33333:33333 ${SUPERVISOR_IDE_CONFIG} /ide-desktop/supervisor-ide-config.json
COPY --chown=33333:33333 components-ide-jetbrains-image--download-${JETBRAINS_DOWNLOAD_QUALIFIER}/backend /ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/backend

ARG JETBRAINS_BACKEND_QUALIFIER
ENV GITPOD_ENV_SET_JETBRAINS_BACKEND_QUALIFIER ${JETBRAINS_BACKEND_QUALIFIER}

COPY --chown=33333:33333 components-ide-jetbrains-cli--app/cli /ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/bin/idea-cli
# TODO get rid of PATH
ENV GITPOD_ENV_APPEND_PATH /ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/bin:

LABEL "io.gitpod.ide.version"=$JETBRAINS_BACKEND_VERSION
