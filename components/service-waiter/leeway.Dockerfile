# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:4857dbc65f7dbf22dd662370a6b211621eba5550d276a9b2ad2596b666cbbdfe

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

RUN adduser -S -D -H -h /app -u 31001 appuser
COPY components-service-waiter--app/service-waiter /app/service-waiter
RUN chown -R appuser /app

USER appuser
ENTRYPOINT [ "/app/service-waiter" ]
CMD [ "-v", "help" ]
