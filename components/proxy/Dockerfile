# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM golang:1.16 as builder

RUN curl -fsSL https://github.com/caddyserver/xcaddy/releases/download/v0.1.9/xcaddy_0.1.9_linux_amd64.tar.gz \
  | tar -xzv -C /usr/local/bin/ xcaddy

WORKDIR /plugins

COPY plugins /plugins

# the fork contains two changes:
# - configure http/2 server
# - update golang.org/x/net go dependency
# TODO (aledbf): use upstream once the fixes are applied.
RUN git clone -b http2 https://github.com/aledbf/caddy caddy-fork

# build caddy
RUN xcaddy build \
  --output /caddy \
  --with github.com/caddyserver/caddy/v2=$PWD/caddy-fork \
  --with github.com/gitpod-io/gitpod/proxy/plugins/corsorigin=/plugins/corsorigin \
  --with github.com/gitpod-io/gitpod/proxy/plugins/secwebsocketkey=/plugins/secwebsocketkey \
  --with github.com/gitpod-io/gitpod/proxy/plugins/workspacedownload=/plugins/workspacedownload \
  --with github.com/gitpod-io/gitpod/proxy/plugins/headlesslogdownload=/plugins/headlesslogdownload \
  --with github.com/gitpod-io/gitpod/proxy/plugins/logif=/plugins/logif \
  --with github.com/gitpod-io/gitpod/proxy/plugins/jsonselect=/plugins/jsonselect

FROM alpine:3.14

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates bash

# Debug convenience
ENV TERM=xterm
ENV SHELL=/bin/bash

COPY --from=builder /caddy /usr/bin/caddy

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY conf/vhost.empty /etc/caddy/vhosts/vhost.empty

CMD [ "caddy", "run", "-watch", "-config", "/etc/caddy/Caddyfile" ]
