# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base@sha256:a7db49b55bd97c12cd686272325bbac236830111db336e084b89f5c816ab0537 as base_builder
RUN mkdir /ide-desktop-plugins

# for debugging
# FROM cgr.dev/chainguard/wolfi-base@sha256:a7db49b55bd97c12cd686272325bbac236830111db336e084b89f5c816ab0537
FROM scratch
ARG JETBRAINS_BACKEND_QUALIFIER
# ensures right permissions for /ide-desktop-plugins
COPY --from=base_builder --chown=33333:33333 /ide-desktop-plugins/ /ide-desktop-plugins/
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote-${JETBRAINS_BACKEND_QUALIFIER}/

# added for backwards compatibility, can be removed in the future
COPY --chown=33333:33333 components-ide-jetbrains-backend-plugin--plugin-${JETBRAINS_BACKEND_QUALIFIER}/build/gitpod-remote /ide-desktop-plugins/gitpod-remote/
