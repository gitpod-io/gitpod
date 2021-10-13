# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM node:16.12.0-slim as builder
COPY components-ee-db-sync--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM node:16.12.0-slim
# '--no-log-init': see https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
RUN useradd --no-log-init --create-home --uid 31002 --home-dir /app/ unode
COPY --from=builder /app /app/
USER unode
WORKDIR /app/node_modules/@gitpod/db-sync
ENTRYPOINT [ "yarn", "start" ]
CMD [ "run", "--soft-start" ]