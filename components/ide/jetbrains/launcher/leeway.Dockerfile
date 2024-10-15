# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:1e1f283d9d69a2b08bc6da47f53dc29d64b975dcb1c3d4276a22ff30543142ea as base_builder
RUN mkdir /ide-desktop

# for debugging
# FROM cgr.dev/chainguard/wolfi-base:latest@sha256:1e1f283d9d69a2b08bc6da47f53dc29d64b975dcb1c3d4276a22ff30543142ea
FROM scratch
ARG JETBRAINS_BACKEND_VERSION
# ensures right permissions for /ide-desktop
COPY --from=base_builder --chown=33333:33333 /ide-desktop/ /ide-desktop/
COPY --chown=33333:33333 components-ide-jetbrains-launcher--app/launcher /ide-desktop/jb-launcher
