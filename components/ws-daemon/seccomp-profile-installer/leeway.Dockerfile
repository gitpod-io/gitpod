# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:fea6eed46b4e4bfcb3632dbac2e34c0b1eb202385fe0c5065278530e4f8d7cff

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache

WORKDIR /installer
COPY components-ws-daemon-seccomp-profile-installer--profile/workspace_default.json .
