# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:1fd981aa0bcefd8da87ce55a9ae907862fcb6835c658fdb284867117fb0268ce

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates git bash sudo

COPY dev-changelog--app/changelog /app/
RUN chmod +x /app/changelog
