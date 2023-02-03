# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base@sha256:ad3c07c4f23df2a8082beae4636025dba212b4495aa9faa0b5d8acda914a2673 as base_builder
RUN mkdir /ide-desktop

# for debugging
# FROM cgr.dev/chainguard/wolfi-base@sha256:ad3c07c4f23df2a8082beae4636025dba212b4495aa9faa0b5d8acda914a2673
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
ENV GITPOD_ENV_APPEND_PATH /ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/bin:

# editor config
ENV GITPOD_ENV_SET_EDITOR "/ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/bin/idea-cli open"
ENV GITPOD_ENV_SET_VISUAL "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GP_OPEN_EDITOR "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR "$GITPOD_ENV_SET_EDITOR --wait"
ENV GITPOD_ENV_SET_GP_PREVIEW_BROWSER "/ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/bin/idea-cli preview"
ENV GITPOD_ENV_SET_GP_EXTERNAL_BROWSER "/ide-desktop/${JETBRAINS_DOWNLOAD_QUALIFIER}/bin/idea-cli preview"

LABEL "io.gitpod.ide.version"=$JETBRAINS_BACKEND_VERSION
