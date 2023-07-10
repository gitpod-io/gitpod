# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:3a1c907d0a8ca6666a9d1f90dabddb654088129d718ce7affb9b906e39a3b7e7

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
