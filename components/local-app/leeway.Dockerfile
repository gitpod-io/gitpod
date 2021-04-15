# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.13

WORKDIR /app
COPY components-local-app--app/components-local-app--app-linux/local-app local-app-linux
COPY components-local-app--app/components-local-app--app-darwin/local-app local-app-darwin
COPY components-local-app--app/components-local-app--app-windows/local-app.exe local-app-windows.exe

CMD ["/bin/sh", "-c", "cp /app/* /out"]
