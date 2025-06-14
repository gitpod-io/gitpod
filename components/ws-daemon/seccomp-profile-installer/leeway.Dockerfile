# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:08a4c4fc8583c217c853fda751f08495530d105c361b714f6d33ae3edb5ec11c

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache

WORKDIR /installer
COPY components-ws-daemon-seccomp-profile-installer--profile/workspace_default.json .
