# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:latest

RUN apk add --no-cache git bash ca-certificates
COPY dev-containerd-metrics--app/containerd-metrics /app/
RUN chmod +x /app/containerd-metrics

ENTRYPOINT [ "/app/containerd-metrics" ]
CMD [ "run" ]