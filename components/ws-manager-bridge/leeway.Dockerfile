# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM node:12.18.3-slim as builder
COPY components-ws-manager-bridge--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM node:12.18.3-slim
EXPOSE 3000
# '--no-log-init': see https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
RUN useradd --no-log-init --create-home --uid 31002 --home-dir /app/ unode
COPY --from=builder /app /app/
USER unode
WORKDIR /app/node_modules/@gitpod/ws-manager-bridge
CMD exec yarn start-ee
