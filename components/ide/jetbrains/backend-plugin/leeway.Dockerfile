# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:15d5bb6adcecb4f6a1d920fa70c8794345fc08f73c2a71832f03242a9e0fae0c as base_builder
RUN mkdir /ide-desktop-plugins

# for debugging
# FROM cgr.dev/chainguard/wolfi-base:latest@sha256:15d5bb6adcecb4f6a1d920fa70c8794345fc08f73c2a71832f03242a9e0fae0c
FROM scratch
ARG JETBRAINS_BACKEND_QUALIFIER
# ensures right permissions for /ide-desktop-plugins
COPY --from=base_builder --chown=33333:33333 /ide-desktop-plugins/ /ide-desktop-plugins/
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote-${JETBRAINS_BACKEND_QUALIFIER}/

# added for backwards compatibility, can be removed in the future
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote/
