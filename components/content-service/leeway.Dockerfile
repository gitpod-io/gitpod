# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM alpine:latest
RUN apk add ca-certificates
COPY components-content-service--app/content-service /app/content-service
ENTRYPOINT [ "/app/content-service" ]
CMD [ "-v", "help" ]
