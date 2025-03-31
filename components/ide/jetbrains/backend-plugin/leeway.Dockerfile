# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:e3daef4eecf6f1cc4f505d6384871208fe8b476252ae92e109f7f8701f275544 as base_builder
RUN mkdir /ide-desktop-plugins

# for debugging
# FROM cgr.dev/chainguard/wolfi-base:latest@sha256:e3daef4eecf6f1cc4f505d6384871208fe8b476252ae92e109f7f8701f275544
FROM scratch
ARG JETBRAINS_BACKEND_QUALIFIER
# ensures right permissions for /ide-desktop-plugins
COPY --from=base_builder --chown=33333:33333 /ide-desktop-plugins/ /ide-desktop-plugins/
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote-${JETBRAINS_BACKEND_QUALIFIER}/

# added for backwards compatibility, can be removed in the future
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote/
