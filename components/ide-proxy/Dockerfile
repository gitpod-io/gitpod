# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:b3dd9cf08283b959c6a0a3c833e68b2882a50129930215060154b43ae6a3e81c as compress

RUN apk add brotli gzip curl

# Gitpod CLI and Local App
COPY components-local-app--app-with-manifest/bin/* /bin/

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
  done

RUN mkdir -p static/code
RUN curl -o static/code/marketplace.json "https://raw.githubusercontent.com/open-vsx/publish-extensions/e5c7f0ac781b430049c9f07fed10ee5c388b0097/extension-control/extensions.json"

FROM caddy/caddy:2.7.6-alpine

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /static /www
COPY --from=compress /bin /www/static/bin
