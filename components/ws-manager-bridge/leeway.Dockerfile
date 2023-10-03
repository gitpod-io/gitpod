# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:18.17.1-slim as builder
COPY components-ws-manager-bridge--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM cgr.dev/chainguard/node:18.17.1@sha256:af073516c203b6bd0b55a77a806a0950b486f2e9ea7387a32b0f41ea72f20886
ENV NODE_OPTIONS=--unhandled-rejections=warn
EXPOSE 3000
COPY --from=builder --chown=node:node /app /app/
WORKDIR /app/node_modules/@gitpod/ws-manager-bridge

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}

CMD ["./dist/index.js"]
