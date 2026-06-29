# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:eba430503496d7a3b3bbf96cb0656e1daa37b6044c61c362778b7e17d371db3a

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

RUN adduser -S -D -H -h /app -u 31001 appuser
COPY components-service-waiter--app/service-waiter /app/service-waiter
RUN chown -R appuser /app

USER appuser
ENTRYPOINT [ "/app/service-waiter" ]
CMD [ "-v", "help" ]
