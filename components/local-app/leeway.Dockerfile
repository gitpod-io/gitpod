# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:077b746426fe23fdca2edbc270a5695c6c03ad26b8e8006fcb2d8e0a7740cc28

WORKDIR /app

# Local App

COPY components-local-app--local-app/components-local-app--local-app-linux-amd64/local-app local-app-linux
COPY components-local-app--local-app/components-local-app--local-app-darwin-amd64/local-app local-app-darwin
COPY components-local-app--local-app/components-local-app--local-app-windows-amd64/local-app.exe local-app-windows.exe

COPY components-local-app--local-app/components-local-app--local-app-linux-amd64/local-app local-app-linux-amd64
COPY components-local-app--local-app/components-local-app--local-app-darwin-amd64/local-app local-app-darwin-amd64
COPY components-local-app--local-app/components-local-app--local-app-windows-amd64/local-app.exe local-app-windows-amd64.exe

COPY components-local-app--local-app/components-local-app--local-app-linux-arm64/local-app local-app-linux-arm64
COPY components-local-app--local-app/components-local-app--local-app-darwin-arm64/local-app local-app-darwin-arm64
COPY components-local-app--local-app/components-local-app--local-app-windows-arm64/local-app.exe local-app-windows-arm64.exe
COPY components-local-app--local-app/components-local-app--local-app-windows-386/local-app.exe local-app-windows-386.exe

# Gitpod CLI

COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-linux-amd64/gitpod-cli gitpod-linux
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-darwin-amd64/gitpod-cli gitpod-darwin
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-amd64/gitpod-cli gitpod-windows.exe

COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-linux-amd64/gitpod-cli gitpod-linux-amd64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-darwin-amd64/gitpod-cli gitpod-darwin-amd64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-amd64/gitpod-cli gitpod-windows-amd64.exe

COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-linux-arm64/gitpod-cli gitpod-linux-arm64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-darwin-arm64/gitpod-cli gitpod-darwin-arm64
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-arm64/gitpod-cli gitpod-windows-arm64.exe
COPY components-local-app--gitpod-cli/components-local-app--gitpod-cli-windows-386/gitpod-cli gitpod-windows-386.exe

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
CMD ["/bin/sh", "-c", "cp /app/* /out"]
