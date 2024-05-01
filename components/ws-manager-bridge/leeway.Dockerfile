# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:20-slim as builder
COPY components-ws-manager-bridge--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM cgr.dev/chainguard/node:20@sha256:f30d39c6980f0a50119f2aa269498307a80c2654928d8e23bb25431b9cbbdc4f
ENV NODE_OPTIONS=--unhandled-rejections=warn
EXPOSE 3000
COPY --from=builder --chown=node:node /app /app/
WORKDIR /app/node_modules/@gitpod/ws-manager-bridge

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

CMD ["./dist/index.js"]
