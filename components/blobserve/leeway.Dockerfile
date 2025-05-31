# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:cb5d1d9d5d562191f7f1c37c2ee21e8a9cdf3d25bf1faa4ac10ee375597ef9db

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

RUN adduser -S -D -H -h /app -u 1000 appuser
COPY components-blobserve--app/blobserve /app/blobserve
RUN chown -R appuser /app

USER appuser

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/blobserve" ]
CMD [ "-v", "help" ]
