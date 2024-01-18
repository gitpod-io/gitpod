# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:2e17912a5f4665ad2a0b85caf242d5a412bc4d18a5850bfc8245367b545ca7d3 as base_builder
RUN mkdir /ide-desktop

# for debugging
# FROM cgr.dev/chainguard/wolfi-base:latest@sha256:2e17912a5f4665ad2a0b85caf242d5a412bc4d18a5850bfc8245367b545ca7d3
FROM scratch
ARG JETBRAINS_BACKEND_VERSION
# ensures right permissions for /ide-desktop
COPY --from=base_builder --chown=33333:33333 /ide-desktop/ /ide-desktop/
COPY --chown=33333:33333 components-ide-jetbrains-launcher--app/launcher /ide-desktop/jb-launcher
