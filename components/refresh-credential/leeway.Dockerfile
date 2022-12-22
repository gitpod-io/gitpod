# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM alpine:3.16

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

RUN adduser -S -D -H -h /app -u 31001 appuser
COPY components-refresh-credential--app/refresh-credential /app/refresh-credential
RUN chown -R appuser /app

USER appuser
ENTRYPOINT [ "/app/refresh-credential" ]
CMD [ "-v", "help" ]
