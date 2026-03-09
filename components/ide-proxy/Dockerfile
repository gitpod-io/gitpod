# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0836c58489cd1baee1f617ab06a4fb1b908604d4416022173e4da43ff12399de as compress

RUN apk add brotli gzip curl

# Gitpod CLI and Local App — use a dedicated directory to avoid copying
# system binaries (e.g. glibc's ldconfig) into the final image.
COPY components-local-app--app-with-manifest/bin/* /app-bin/

RUN for FILE in `ls /app-bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
  done

RUN mkdir -p static/code
RUN curl -o static/code/marketplace.json "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/d9a7cc2d486ca881e9df310324f9752f48156283/extension-control/extensions.json"

# Build Caddy from source with v2.11.1 (includes security fixes)
FROM caddy:builder AS caddy-builder
RUN xcaddy build v2.11.1 --output /caddy

FROM caddy/caddy:2.11-alpine

# Ensure latest packages are present, like security updates.
RUN apk upgrade --no-cache

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /static /www
COPY --from=compress /app-bin /www/static/bin
