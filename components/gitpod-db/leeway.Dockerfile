# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM node:22.22.3-alpine AS builder

# Install bash
RUN apk update && \
    apk add bash && \
    rm -rf /var/cache/apk/*

COPY components-gitpod-db--migrations /installer/
WORKDIR /app
RUN /installer/install.sh

FROM node:22.22.3-alpine
RUN apk upgrade --no-cache \
    && apk add --no-cache bash

ENV NODE_OPTIONS=--unhandled-rejections=warn
COPY migrate.sh /app/migrate.sh
COPY typeorm.sh /app/typeorm.sh
RUN mkdir /home/jenkins && chown -R 10000 /home/jenkins
COPY --chown=10000:10000 --from=builder /app /app/
WORKDIR /app/node_modules/@gitpod/gitpod-db

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
