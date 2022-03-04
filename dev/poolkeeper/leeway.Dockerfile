# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

COPY dev-poolkeeper--app/poolkeeper /app/
RUN chmod +x /app/poolkeeper

ENTRYPOINT [ "/app/poolkeeper" ]