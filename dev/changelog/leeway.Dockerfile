# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:bf0547b7d8d03e4f43e3e2b91630af5dc560bd91d09b8286148da8ffebd2092a

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates git bash sudo

COPY dev-changelog--app/changelog /app/
RUN chmod +x /app/changelog
