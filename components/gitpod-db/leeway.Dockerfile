# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM node:12.18.3-slim as builder
COPY components-gitpod-db--migrations /installer/

WORKDIR /app
RUN /installer/install.sh


FROM node:12.18.3-slim
RUN mkdir /home/jenkins && chown -R 10000 /home/jenkins
COPY --chown=10000:10000 --from=builder /app /app/
WORKDIR /app/node_modules/@gitpod/gitpod-db

RUN echo "#!/bin/bash"                                                            >> /app/migrate.sh && \
    echo "yarn --cwd /app/node_modules/@gitpod/gitpod-db run wait-for-db"        >> /app/migrate.sh && \
    echo "yarn --cwd /app/node_modules/@gitpod/gitpod-db typeorm migrations:run" >> /app/migrate.sh && \
    chmod +x /app/migrate.sh