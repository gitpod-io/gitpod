# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:latest

RUN apk add --no-cache ca-certificates

COPY dev-poolkeeper--app/poolkeeper /app/
RUN chmod +x /app/poolkeeper

ENTRYPOINT [ "/app/poolkeeper" ]