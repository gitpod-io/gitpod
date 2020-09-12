# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM node:12.18.3 AS node_installer
RUN mkdir -p /ide/node/bin \
    /ide/node/include/node/ \
    /ide/node/lib/node_modules/npm/ \
    /ide/node/lib/ && \
    cp -a  /usr/local/bin/node              /ide/node/bin/ && \
    cp -a  /usr/local/bin/npm               /ide/node/bin/ && \
    cp -a  /usr/local/bin/npx               /ide/node/bin/ && \
    cp -ar /usr/local/include/node/         /ide/node/include/ && \
    cp -ar /usr/local/lib/node_modules/npm/ /ide/node/lib/node_modules/

# rename node executable
RUN cp /ide/node/bin/node /ide/node/bin/gitpod-node && rm /ide/node/bin/node


FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-12 as code_installer

# change this counter to fetch latest changes
ENV TRIGGER_REBUILD 13

# see https://github.com/gitpod-io/vscode/blob/bdeca3f8709b70b339f41fc2a14e94f83d6475ac/.github/workflows/ci.yml#L130
RUN sudo apt-get update \
    && sudo apt-get -y install --no-install-recommends libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 libgbm1 \
    # Clean up
    && sudo apt-get autoremove -y \
    && sudo apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/gitpod-io/vscode.git --branch gp-code --single-branch gp-code
WORKDIR /gp-code
RUN yarn
RUN yarn gulp gitpod

# grant write permissions for built-in extensions
RUN chmod -R ugo+w /gitpod-pkg-server/extensions

FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --from=code_installer /gitpod-pkg-web/ /ide/
COPY --from=code_installer /gitpod-pkg-server/ /ide/
COPY --from=node_installer /ide/node /ide/node
COPY startup.sh supervisor-ide-config.json /ide/