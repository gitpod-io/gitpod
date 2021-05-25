# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.

FROM node:12.18.3-slim as builder
COPY components-ee-payment-endpoint--app /installer/

WORKDIR /app
RUN /installer/install.sh

FROM node:12.18.3-slim

EXPOSE 3000

RUN useradd --create-home --uid 31001 --home-dir /app/ unode
COPY --from=builder /app /app/
USER unode
WORKDIR /app/node_modules/@gitpod/gitpod-payment-endpoint
CMD exec yarn start