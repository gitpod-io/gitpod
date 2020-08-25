# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM golang:1.13-alpine AS debugger
RUN apk add --no-cache git
RUN go get -u github.com/go-delve/delve/cmd/dlv

FROM alpine:latest
RUN apk add ca-certificates
COPY --from=debugger /go/bin/dlv /usr/bin
COPY components-ws-manager-node--app/ws-manager-node /app/ws-manager-node
ENTRYPOINT [ "/app/ws-manager-node" ]
CMD [ "-v", "help" ]