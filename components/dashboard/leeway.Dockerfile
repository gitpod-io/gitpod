# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:575e8496bd9e839506cc5dca5a99cc2eebac714aa96032c24bb08516f7d78f63 as compress

RUN apk add brotli gzip

COPY components-dashboard--app/build /www

WORKDIR /www

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'gzip -v -f -9 -k "$1"' /bin/sh {} \;

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'brotli -v -q 11 -o "$1.br" "$1"' /bin/sh {} \;

COPY components-gitpod-protocol--gitpod-schema/gitpod-schema.json /www/static/schemas/gitpod-schema.json

FROM caddy/caddy:2.7.5-alpine

COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY --from=compress /www /www

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
