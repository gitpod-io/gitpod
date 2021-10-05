# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM alpine:3.14

RUN apk add --no-cache git bash ca-certificates
COPY components-ee-kedge--app/kedge /app/
RUN chmod +x /app/kedge

ENTRYPOINT [ "/app/kedge" ]
CMD [ "-v", "help" ]