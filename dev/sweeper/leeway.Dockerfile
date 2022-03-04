# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates curl git

RUN curl -L https://github.com/csweichel/werft/releases/download/v0.0.4rc/werft-client-linux-amd64.tar.gz | tar xz && \
    mv werft-client-linux-amd64 /usr/bin/werft

COPY dev-sweeper--app/sweeper /app/
RUN chmod +x /app/sweeper

ENTRYPOINT [ "/app/sweeper" ]