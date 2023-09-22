# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:d141305384203efd88710c735d71a3975371174ad882c181b5ce0bdb583615e6

WORKDIR /app
COPY components-local-app--app/components-local-app--app-linux-amd64/local-app local-app-linux
COPY components-local-app--app/components-local-app--app-darwin-amd64/local-app local-app-darwin
COPY components-local-app--app/components-local-app--app-windows-amd64/local-app.exe local-app-windows.exe

COPY components-local-app--app/components-local-app--app-linux-amd64/local-app local-app-linux-amd64
COPY components-local-app--app/components-local-app--app-darwin-amd64/local-app local-app-darwin-amd64
COPY components-local-app--app/components-local-app--app-windows-amd64/local-app.exe local-app-windows-amd64.exe

COPY components-local-app--app/components-local-app--app-linux-arm64/local-app local-app-linux-arm64
COPY components-local-app--app/components-local-app--app-darwin-arm64/local-app local-app-darwin-arm64
COPY components-local-app--app/components-local-app--app-windows-arm64/local-app.exe local-app-windows-arm64.exe
COPY components-local-app--app/components-local-app--app-windows-386/local-app.exe local-app-windows-386.exe

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
CMD ["/bin/sh", "-c", "cp /app/* /out"]
