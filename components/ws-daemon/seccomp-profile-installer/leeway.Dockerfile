# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:a5a619c1793039dcf92f02178f37c94bb3d6001403716da59d6092dfe8d9b502

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache

WORKDIR /installer
COPY components-ws-daemon-seccomp-profile-installer--profile/workspace_default.json .
