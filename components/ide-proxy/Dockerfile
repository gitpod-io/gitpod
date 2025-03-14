# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:79884062be1fd5f698859ee4044c6d13729fabeb9eb1f34aacfc6120414f8a91 as compress

RUN apk add brotli gzip curl

# Gitpod CLI and Local App
COPY components-local-app--app-with-manifest/bin/* /bin/

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
  done

RUN mkdir -p static/code
RUN curl -o static/code/marketplace.json "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/d9a7cc2d486ca881e9df310324f9752f48156283/extension-control/extensions.json"

FROM caddy/caddy:2.7.6-alpine

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /static /www
COPY --from=compress /bin /www/static/bin
