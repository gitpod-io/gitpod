# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM alpine:3.16

RUN apk add --no-cache git bash ca-certificates
COPY components-ee-agent-smith--app/agent-smith /app/
RUN chmod +x /app/agent-smith

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/agent-smith" ]
CMD [ "-v", "help" ]
