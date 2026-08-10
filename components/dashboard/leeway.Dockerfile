# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:0a430fcad24f823d24783d019d7ff2c970aa4899c0e54f1f9de75f0382cf6b27 as compress

RUN apk add brotli gzip

COPY components-dashboard--app/build /www

WORKDIR /www

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'gzip -v -f -9 -k "$1"' /bin/sh {} \;

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'brotli -v -q 11 -o "$1.br" "$1"' /bin/sh {} \;

COPY components-gitpod-protocol--gitpod-schema/gitpod-schema.json /www/static/schemas/gitpod-schema.json

# Build Caddy from source with smallstep/certificates pinned to v0.30.1 (fixes GHSA-q4r8-xm5f-56gw)
FROM caddy:2.11.4-builder AS caddy-builder
RUN xcaddy build v2.11.4 \
  --replace github.com/smallstep/certificates=github.com/smallstep/certificates@v0.30.1 \
  --output /caddy

FROM caddy/caddy:2.11.4-alpine@sha256:ef2ad799652965da62f0548e15e00ebcef221dd6f29623d3455df6273ca39f46

# Keep runtime packages current and remove the unused curl client inherited from Caddy.
RUN apk upgrade --no-cache \
  && apk del curl

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY --from=compress /www /www

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
