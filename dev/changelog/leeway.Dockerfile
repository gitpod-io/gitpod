# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:077b746426fe23fdca2edbc270a5695c6c03ad26b8e8006fcb2d8e0a7740cc28

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates git bash sudo

COPY dev-changelog--app/changelog /app/
RUN chmod +x /app/changelog
