# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:22.22.0-alpine AS builder

# Install bash for the installer script
RUN apk update && \
    apk add bash && \
    rm -rf /var/cache/apk/*

COPY components-ws-manager-bridge--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM node:22.22.0-alpine
ENV NODE_OPTIONS=--unhandled-rejections=warn
EXPOSE 3000
COPY --from=builder --chown=node:node /app /app/
WORKDIR /app/node_modules/@gitpod/ws-manager-bridge

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

CMD ["./dist/index.js"]
