# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM alpine:latest

RUN apk add --no-cache git bash ca-certificates
COPY components-agent-smith--app/agent-smith /app/
RUN chmod +x /app/agent-smith
COPY components-agent-smith--falco-bpf-probe/probe.o /app/probe.o

ENTRYPOINT [ "/app/agent-smith" ]
CMD [ "-v", "help" ]
