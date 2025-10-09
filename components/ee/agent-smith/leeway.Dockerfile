# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.



FROM cgr.dev/chainguard/wolfi-base:latest@sha256:815b27b8a70713c70404e44a718eddd52ea6f4a2bfad5f56455b52cd2789a9b2

RUN apk add --no-cache git bash ca-certificates
COPY components-ee-agent-smith--app/agent-smith /app/
RUN chmod +x /app/agent-smith

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
ENTRYPOINT [ "/app/agent-smith" ]
CMD [ "-v", "help" ]
