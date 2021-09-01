# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM node:12.22.1-slim as builder

RUN apt-get update && apt-get install -y build-essential python

COPY components-server--app /installer/

WORKDIR /app
RUN /installer/install.sh


FROM node:12.22.1-slim

# Using ssh-keygen for RSA keypair generation
RUN apt-get update && apt-get install -yq \
        openssh-client \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

EXPOSE 3000

# '--no-log-init': see https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
RUN useradd --no-log-init --create-home --uid 31001 --home-dir /app/ unode
COPY --from=builder /app /app/
USER unode
WORKDIR /app/node_modules/@gitpod/server
# Don't use start-ee-inspect as long as we use native modules (casues segfault)
CMD exec yarn start-ee
