# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:18.17.1-slim as builder
COPY components-server--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM cgr.dev/chainguard/node:18.17.1@sha256:fbaecf4d6ac9883699078c0b501aad22c866f9ce039d009212c0eed260914875
ENV NODE_OPTIONS="--unhandled-rejections=warn --max_old_space_size=2048"

EXPOSE 3000

COPY --from=builder --chown=node:node /app /app/
WORKDIR /app/node_modules/@gitpod/server

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
CMD ["./dist/main.js"]
