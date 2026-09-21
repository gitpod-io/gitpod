# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:32d119bfa89c4302e0608f5c120b39c6b8f80b592c7fb46aa27008b2669ce220 as compress

RUN apk add brotli gzip curl

# Gitpod CLI and Local App — use a dedicated directory to avoid copying
# system binaries (e.g. glibc's ldconfig) into the final image.
COPY components-local-app--app-with-manifest/bin/* /app-bin/

RUN for FILE in `ls /app-bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
  done

RUN mkdir -p static/code
RUN curl -o static/code/marketplace.json "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/d9a7cc2d486ca881e9df310324f9752f48156283/extension-control/extensions.json"

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

FROM caddy/caddy:2.11.4-alpine@sha256:d71500cabcc62e8efcd30fd9cb8aca2f4fb00f396f9444d8deefbc6daec4016e

# Keep runtime packages current and remove the unused curl client inherited from Caddy.
RUN apk upgrade --no-cache libssl3 libcrypto3 \
  && apk upgrade --no-cache \
  && apk del curl

COPY --from=caddy-builder /caddy /usr/bin/caddy
COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /static /www
COPY --from=compress /app-bin /www/static/bin
