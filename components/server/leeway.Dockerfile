# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:22.22.0-alpine AS builder

# Install Python, make, gcc and g++ for node-gyp
RUN apk update && \
    apk add python3 make gcc g++ bash && \
    rm -rf /var/cache/apk/*

COPY components-server--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM node:22.22.0-alpine
ENV NODE_OPTIONS="--unhandled-rejections=warn --max_old_space_size=2048"

EXPOSE 3000

COPY --from=builder --chown=node:node /app /app/
WORKDIR /app/node_modules/@gitpod/server

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
CMD ["./dist/main.js"]
