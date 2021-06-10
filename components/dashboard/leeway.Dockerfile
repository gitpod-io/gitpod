# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.13 as compress

RUN apk add brotli gzip

COPY components-dashboard--app/build /www

WORKDIR /www

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'gzip -v -f -9 -k "$1"' /bin/sh {} \;

RUN find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.png' -o -name '*.svg' -o -name '*.map' -o -name '*.json' \) \
  -exec /bin/sh -c 'brotli -v -q 11 -o "$1.br" "$1"' /bin/sh {} \;

COPY components-local-app--app/components-local-app--app-linux/local-app /www/static/bin/gitpod-local-companion-linux
COPY components-local-app--app/components-local-app--app-darwin/local-app /www/static/bin/gitpod-local-companion-darwin
COPY components-local-app--app/components-local-app--app-windows/local-app.exe /www/static/bin/gitpod-local-companion-windows.exe

COPY components-gitpod-protocol--gitpod-schema/gitpod-schema.json /www/static/schemas/gitpod-schema.json

RUN for PLATFORM in linux darwin windows.exe;do \
  gzip -v -f -9 -k "/www/static/bin/gitpod-local-companion-$PLATFORM"; \
done

FROM caddy/caddy:2.4.0-alpine

COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY --from=compress /www /www
