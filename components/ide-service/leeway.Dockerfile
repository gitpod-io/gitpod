# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM alpine:3.16

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  # bash: for devx
  # tar: make kubectl cp work
  && apk add --no-cache ca-certificates bash tar

COPY components-ide-service--app/ide-service /app/ide-service

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/ide-service" ]
