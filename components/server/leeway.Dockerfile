# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:18.17.1-slim AS builder

# Install Python, make, gcc and g++ for node-gyp
RUN apt-get update && \
    apt-get install -y python3 make gcc g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY components-server--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM cgr.dev/chainguard/node:18.17.1@sha256:af073516c203b6bd0b55a77a806a0950b486f2e9ea7387a32b0f41ea72f20886
ENV NODE_OPTIONS="--unhandled-rejections=warn --max_old_space_size=2048"

EXPOSE 3000

COPY --from=builder --chown=node:node /app /app/
WORKDIR /app/node_modules/@gitpod/server

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
CMD ["./dist/main.js"]
