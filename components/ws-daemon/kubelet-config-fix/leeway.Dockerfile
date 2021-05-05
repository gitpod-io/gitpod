# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:3.13

# Ensure latest packages are present, like security updates.
RUN apk upgrade --no-cache

WORKDIR /app
COPY components-ws-daemon-kubelet-config-fix--app/kubelet-config-fix .

ENTRYPOINT [ "/app/kubelet-config-fix" ]
