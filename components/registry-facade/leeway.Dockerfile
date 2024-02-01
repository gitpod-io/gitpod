# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:fea6eed46b4e4bfcb3632dbac2e34c0b1eb202385fe0c5065278530e4f8d7cff

# Ensure latest packages are present, like security updates.
RUN apk upgrade --no-cache \
  && apk add ca-certificates --no-cache

RUN adduser -S -D -H -h /app -u 1000 appuser
COPY components-registry-facade--app/registry-facade /app/registry-facade
RUN chown -R appuser /app

USER appuser

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/registry-facade" ]
CMD [ "-v", "help" ]
