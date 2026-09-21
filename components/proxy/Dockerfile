# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM caddy:2.11.4-builder AS builder

WORKDIR /plugins

COPY plugins /plugins

# Patch dependencies reported by Grype:
# github.com/buger/jsonparser: GHSA-6g7g-w4f8-9c9x
# golang.org/x/crypto: GO-2026-6303, GO-2026-6354, GO-2026-6355
# golang.org/x/net: GO-2026-5942
# golang.org/x/text: GO-2026-5970
# google.golang.org/grpc: GHSA-2v4p-qf9q-27wj, GHSA-hrxh-6v49-42gf, GHSA-vp52-pcj8-j9qc
# Retain the smallstep/certificates fix for GHSA-q4r8-xm5f-56gw.
RUN xcaddy build v2.11.4 \
  --output /caddy \
  --replace github.com/buger/jsonparser=github.com/buger/jsonparser@v1.1.2 \
  --replace github.com/smallstep/certificates=github.com/smallstep/certificates@v0.30.1 \
  --replace golang.org/x/crypto=golang.org/x/crypto@v0.56.0 \
  --replace golang.org/x/net=golang.org/x/net@v0.58.0 \
  --replace golang.org/x/text=golang.org/x/text@v0.41.0 \
  --replace google.golang.org/grpc=google.golang.org/grpc@v1.83.2 \
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

FROM caddy/caddy:2.11.4-alpine@sha256:d71500cabcc62e8efcd30fd9cb8aca2f4fb00f396f9444d8deefbc6daec4016e

# Keep runtime packages current and remove the unused curl client inherited from Caddy.
RUN apk upgrade --no-cache libssl3 libcrypto3 \
  && apk upgrade --no-cache \
  && apk del curl \
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
