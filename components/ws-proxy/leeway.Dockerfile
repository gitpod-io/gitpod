# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.13

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

RUN adduser -S -D -H -h /app -u 1000 appuser
COPY components-ws-proxy--app/ws-proxy /app/ws-proxy
COPY public /app/public
RUN chown -R appuser /app

USER appuser
ENTRYPOINT [ "/app/ws-proxy" ]
CMD [ "-v", "help" ]
