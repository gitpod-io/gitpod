# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:077b746426fe23fdca2edbc270a5695c6c03ad26b8e8006fcb2d8e0a7740cc28 as compress

RUN apk add brotli gzip

# Local App

COPY components-local-app--local-app/components-local-app--local-app-linux-amd64/local-app /bin/gitpod-local-companion-linux-amd64
COPY components-local-app--local-app/components-local-app--local-app-darwin-amd64/local-app /bin/gitpod-local-companion-darwin-amd64
COPY components-local-app--local-app/components-local-app--local-app-windows-amd64/local-app.exe /bin/gitpod-local-companion-windows-amd64.exe
COPY components-local-app--local-app/components-local-app--local-app-linux-arm64/local-app /bin/gitpod-local-companion-linux-arm64
COPY components-local-app--local-app/components-local-app--local-app-darwin-arm64/local-app /bin/gitpod-local-companion-darwin-arm64
COPY components-local-app--local-app/components-local-app--local-app-windows-arm64/local-app.exe /bin/gitpod-local-companion-windows-arm64.exe
COPY components-local-app--local-app/components-local-app--local-app-windows-386/local-app.exe /bin/gitpod-local-companion-windows-386.exe

# Gitpod CLI

COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-linux-amd64/gitpod-cli /bin/gitpod-linux-amd64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-darwin-amd64/gitpod-cli /bin/gitpod-darwin-amd64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-amd64/gitpod-cli.exe /bin/gitpod-windows-amd64.exe
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-linux-arm64/gitpod-cli /bin/gitpod-linux-arm64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-darwin-arm64/gitpod-cli /bin/gitpod-darwin-arm64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-arm64/gitpod-cli.exe /bin/gitpod-windows-arm64.exe
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-386/gitpod-cli.exe /bin/gitpod-windows-386.exe

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
done

FROM caddy/caddy:2.7.5-alpine

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /bin /www/static/bin
