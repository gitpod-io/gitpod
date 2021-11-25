# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.15 as compress

RUN apk add brotli gzip

COPY components-dashboard--app/build /www

WORKDIR /www

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'gzip -v -f -9 -k "$1"' /bin/sh {} \;

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'brotli -v -q 11 -o "$1.br" "$1"' /bin/sh {} \;

COPY components-local-app--app/components-local-app--app-linux-amd64/local-app /www/static/bin/gitpod-local-companion-linux-amd64
COPY components-local-app--app/components-local-app--app-darwin-amd64/local-app /www/static/bin/gitpod-local-companion-darwin-amd64
COPY components-local-app--app/components-local-app--app-windows-amd64/local-app.exe /www/static/bin/gitpod-local-companion-windows-amd64.exe
COPY components-local-app--app/components-local-app--app-linux-arm64/local-app /www/static/bin/gitpod-local-companion-linux-arm64
COPY components-local-app--app/components-local-app--app-darwin-arm64/local-app /www/static/bin/gitpod-local-companion-darwin-arm64
COPY components-local-app--app/components-local-app--app-windows-386/local-app.exe /www/static/bin/gitpod-local-companion-windows-arm64.exe
COPY components-local-app--app/components-local-app--app-windows-386/local-app.exe /www/static/bin/gitpod-local-companion-windows-386.exe

COPY components-gitpod-protocol--gitpod-schema/gitpod-schema.json /www/static/schemas/gitpod-schema.json

RUN for FILE in `ls /www/static/bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
done

FROM caddy/caddy:2.4.0-alpine

COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY --from=compress /www /www
