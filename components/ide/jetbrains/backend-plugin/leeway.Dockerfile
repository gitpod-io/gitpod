# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:b9bcdb04c2dd6fc720a86ce02c9d4442541cbdfe0871b1ea23d0a0b8d12c216c as base_builder
RUN mkdir /ide-desktop-plugins

# for debugging
# FROM cgr.dev/chainguard/wolfi-base:latest@sha256:b9bcdb04c2dd6fc720a86ce02c9d4442541cbdfe0871b1ea23d0a0b8d12c216c
FROM scratch
ARG JETBRAINS_BACKEND_QUALIFIER
# ensures right permissions for /ide-desktop-plugins
COPY --from=base_builder --chown=33333:33333 /ide-desktop-plugins/ /ide-desktop-plugins/
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote-${JETBRAINS_BACKEND_QUALIFIER}/

# added for backwards compatibility, can be removed in the future
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote/
