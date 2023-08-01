# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:b795369ce4150f0a038af4b9b20a37d2ae70337d45530d45de96b28d9b17a530

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
