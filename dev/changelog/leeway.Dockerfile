# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:c066d2f07da43020e6faac7eaf3866a50e8fb284ec6f81a1b233b595d0b6ae9a

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates git bash sudo

COPY dev-changelog--app/changelog /app/
RUN chmod +x /app/changelog
