# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:671a584ae9af3acea08b53e19ea1f7df2bc430bb018071f3ab52077e6a906a76 as compress

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
