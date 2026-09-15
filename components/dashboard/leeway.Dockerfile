# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:ac3269eb506fccbf26c73e837f54f44dbeab0cd8338a9292bb5fef0036a4a6ed as compress

RUN apk add brotli gzip

COPY components-dashboard--app/build /www

WORKDIR /www

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'gzip -v -f -9 -k "$1"' /bin/sh {} \;

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'brotli -v -q 11 -o "$1.br" "$1"' /bin/sh {} \;

COPY components-gitpod-protocol--gitpod-schema/gitpod-schema.json /www/static/schemas/gitpod-schema.json

# Patch dependencies reported by Grype:
# golang.org/x/crypto: GO-2026-6303, GO-2026-6354, GO-2026-6355
# golang.org/x/net: GO-2026-5942
# golang.org/x/text: GO-2026-5970
# google.golang.org/grpc: GHSA-2v4p-qf9q-27wj, GHSA-hrxh-6v49-42gf, GHSA-vp52-pcj8-j9qc
# Retain the smallstep/certificates fix for GHSA-q4r8-xm5f-56gw.
FROM caddy:2.11.4-builder AS caddy-builder
RUN xcaddy build v2.11.4 \
  --replace github.com/smallstep/certificates=github.com/smallstep/certificates@v0.30.1 \
  --replace golang.org/x/crypto=golang.org/x/crypto@v0.56.0 \
  --replace golang.org/x/net=golang.org/x/net@v0.58.0 \
  --replace golang.org/x/text=golang.org/x/text@v0.41.0 \
  --replace google.golang.org/grpc=google.golang.org/grpc@v1.83.2 \
  --output /caddy

FROM caddy/caddy:2.11.4-alpine@sha256:ef2ad799652965da62f0548e15e00ebcef221dd6f29623d3455df6273ca39f46

# Keep runtime packages current and remove the unused curl client inherited from Caddy.
RUN apk upgrade --no-cache libssl3 libcrypto3 \
  && apk upgrade --no-cache \
  && apk del curl

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY --from=compress /www /www

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
