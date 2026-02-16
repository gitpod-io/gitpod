# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:c2279797be0446bd0c92a079b1975c5045645e50225016e10ad5782cdffbe410 as compress

RUN apk add brotli gzip curl

# Gitpod CLI and Local App
COPY components-local-app--app-with-manifest/bin/* /bin/

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
  done

RUN mkdir -p static/code
RUN curl -o static/code/marketplace.json "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/d9a7cc2d486ca881e9df310324f9752f48156283/extension-control/extensions.json"

# Build Caddy from source to get v2.11.0-beta.2 with fixed smallstep/certificates
FROM caddy:builder AS caddy-builder
RUN xcaddy build v2.11.0-beta.2 --output /caddy

FROM caddy/caddy:2.11-alpine

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /static /www
COPY --from=compress /bin /www/static/bin
