# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:c85f493847f2a370df7f351676bbbbc89096c139394a1dca6a4b05f5f1108d3a

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

RUN adduser -S -D -H -h /app -u 1000 appuser
COPY components-usage--app/usage /app/usage
RUN chown -R appuser /app

USER appuser

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/usage" ]
CMD [ "-v", "help" ]
