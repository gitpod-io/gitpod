# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:3eff851ab805966c768d2a8107545a96218426cee1e5cc805865505edbe6ce92 as compress

RUN apk add brotli gzip

# Gitpod CLI and Local App
COPY components-local-app--app-with-manifest/bin/* /bin/

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
done

FROM caddy/caddy:2.7.6-alpine

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /bin /www/static/bin
