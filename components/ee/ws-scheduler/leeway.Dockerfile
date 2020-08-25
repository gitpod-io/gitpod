# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM alpine:latest
RUN apk add ca-certificates
COPY components-ee-ws-scheduler--app/ws-scheduler /app/ws-scheduler
ENTRYPOINT [ "/app/ws-scheduler" ]
CMD [ "-v", "help" ]