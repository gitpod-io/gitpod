# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:af8a06428ec2679884374891296754df12d5247ccaf95d2cc5d844d915a2218f

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
