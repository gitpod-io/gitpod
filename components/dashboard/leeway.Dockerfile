# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:a754c7a7a52ef163f833f793b9cfb1870b3707773fcfee949f89d3c9bc66b40b as compress

RUN apk add brotli gzip

COPY components-dashboard--app/build /www

WORKDIR /www

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'gzip -v -f -9 -k "$1"' /bin/sh {} \;

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'brotli -v -q 11 -o "$1.br" "$1"' /bin/sh {} \;

COPY components-gitpod-protocol--gitpod-schema/gitpod-schema.json /www/static/schemas/gitpod-schema.json

# Build Caddy from source to get v2.11.0-beta.2 with fixed smallstep/certificates
FROM caddy:builder AS caddy-builder
RUN xcaddy build v2.11.0-beta.2 --output /caddy

FROM caddy/caddy:2.11-alpine

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY --from=compress /www /www

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
