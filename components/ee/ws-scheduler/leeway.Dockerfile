# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM alpine:3.13

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache ca-certificates

COPY components-ee-ws-scheduler--app/ws-scheduler /app/ws-scheduler
ENTRYPOINT [ "/app/ws-scheduler" ]
CMD [ "-v", "help" ]