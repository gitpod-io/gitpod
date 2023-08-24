# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM caddy:2.6.4-builder-alpine AS builder

WORKDIR /plugins

COPY plugins /plugins

# build caddy
RUN xcaddy build v2.6.3 \
  --output /caddy \
  --with github.com/gitpod-io/gitpod/proxy/plugins/corsorigin=/plugins/corsorigin \
  --with github.com/gitpod-io/gitpod/proxy/plugins/secwebsocketkey=/plugins/secwebsocketkey \
  --with github.com/gitpod-io/gitpod/proxy/plugins/workspacedownload=/plugins/workspacedownload \
  --with github.com/gitpod-io/gitpod/proxy/plugins/headlesslogdownload=/plugins/headlesslogdownload \
  --with github.com/gitpod-io/gitpod/proxy/plugins/configcat=/plugins/configcat \
  --with github.com/gitpod-io/gitpod/proxy/plugins/analytics=/plugins/analytics \
  --with github.com/gitpod-io/gitpod/proxy/plugins/logif=/plugins/logif \
  --with github.com/gitpod-io/gitpod/proxy/plugins/jsonselect=/plugins/jsonselect \
  --with github.com/gitpod-io/gitpod/proxy/plugins/sshtunnel=/plugins/sshtunnel \
  --with github.com/gitpod-io/gitpod/proxy/plugins/frontend_dev=/plugins/frontend_dev

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:909ed72dc072188cce611c98f556b3a4e9a62ad4078d766e78c180eb8b02fa23

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates bash

# Debug convenience
ENV TERM=xterm
ENV SHELL=/bin/bash

COPY --from=builder /caddy /usr/bin/caddy

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY conf/vhost.empty /etc/caddy/vhosts/vhost.empty
COPY conf/workspace-handler.* /etc/caddy/workspace-handler/

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

CMD [ "caddy", "run", "--adapter", "inject-ssh-tunnel" , "--watch", "--config", "/etc/caddy/Caddyfile" ]
