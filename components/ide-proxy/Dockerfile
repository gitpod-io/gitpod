# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:f7b8a6213d3d730683dca3e0f5afdd72f2f8823c19e10659a0185ce3da909d9d as compress

RUN apk add brotli gzip curl

# Gitpod CLI and Local App — use a dedicated directory to avoid copying
# system binaries (e.g. glibc's ldconfig) into the final image.
COPY components-local-app--app-with-manifest/bin/* /app-bin/

RUN for FILE in `ls /app-bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
  done

RUN mkdir -p static/code
RUN curl -o static/code/marketplace.json "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/d9a7cc2d486ca881e9df310324f9752f48156283/extension-control/extensions.json"

# Build Caddy from source with smallstep/certificates pinned to v0.30.1 (fixes GHSA-q4r8-xm5f-56gw)
FROM caddy:2.11.4-builder AS caddy-builder
RUN xcaddy build v2.11.4 \
  --replace github.com/smallstep/certificates=github.com/smallstep/certificates@v0.30.1 \
  --output /caddy

FROM caddy/caddy:2.11.4-alpine

# Ensure latest packages are present, like security updates.
RUN apk upgrade --no-cache

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /static /www
COPY --from=compress /app-bin /www/static/bin
