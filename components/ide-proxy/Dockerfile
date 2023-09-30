# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:ccc5551b5dd1fdcff5fc76ac1605b4c217f77f43410e0bd8a56599d6504dbbdd as compress

RUN apk add brotli gzip

COPY components-local-app--app/components-local-app--app-linux-amd64/local-app /bin/gitpod-local-companion-linux-amd64
COPY components-local-app--app/components-local-app--app-darwin-amd64/local-app /bin/gitpod-local-companion-darwin-amd64
COPY components-local-app--app/components-local-app--app-windows-amd64/local-app.exe /bin/gitpod-local-companion-windows-amd64.exe
COPY components-local-app--app/components-local-app--app-linux-arm64/local-app /bin/gitpod-local-companion-linux-arm64
COPY components-local-app--app/components-local-app--app-darwin-arm64/local-app /bin/gitpod-local-companion-darwin-arm64
COPY components-local-app--app/components-local-app--app-windows-386/local-app.exe /bin/gitpod-local-companion-windows-arm64.exe
COPY components-local-app--app/components-local-app--app-windows-386/local-app.exe /bin/gitpod-local-companion-windows-386.exe

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
done

FROM caddy/caddy:2.6.4-alpine

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /bin /www/static/bin
