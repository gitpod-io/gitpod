# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:646bf367c6e34421dd3edb6f2807782f519553c1c97e3d279f97ccaed2e92d0c

# Ensure latest packages are present, like security updates.
RUN apk upgrade --no-cache \
  && apk add --no-cache git bash ca-certificates

COPY components-image-builder-mk3--app/image-builder /app/
RUN chmod +x /app/image-builder

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/image-builder" ]
CMD [ "-v", "help" ]
