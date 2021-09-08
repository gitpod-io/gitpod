# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# we use latest major version of Node.js distributed VS Code. (see about dialog in your local VS Code)
# ideallay we should use exact version, but it has criticla bugs in regards to grpc over http2 streams
ARG NODE_VERSION=14.17.4


FROM node:${NODE_VERSION} AS node_installer
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


FROM ubuntu:18.04 as code_installer

RUN apt-get update \
    # see https://github.com/microsoft/vscode/blob/42e271dd2e7c8f320f991034b62d4c703afb3e28/.github/workflows/ci.yml#L94
    && apt-get -y install --no-install-recommends libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 libgbm1 \
    && apt-get -y install --no-install-recommends git curl build-essential libssl-dev ca-certificates python \
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION
ENV NVM_DIR /root/.nvm
RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | sh \
    && . $NVM_DIR/nvm.sh  \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && npm install -g yarn node-gyp
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

ENV GP_CODE_COMMIT 26bf7356a65baf730233257f41d77ebbf7e977f3
RUN mkdir gp-code \
    && cd gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/vscode \
    && git fetch origin $GP_CODE_COMMIT \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code
RUN yarn
RUN yarn --cwd ./extensions compile
RUN yarn gulp gitpod-min

# grant write permissions for built-in extensions
RUN chmod -R ugo+w /gitpod-pkg-server/extensions

# cli config
COPY bin /ide/bin
RUN chmod -R ugo+x /ide/bin


FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --from=code_installer /gitpod-pkg-web/ /ide/
COPY --from=code_installer /gitpod-pkg-server/ /ide/
COPY --from=node_installer /ide/node /ide/node
COPY startup.sh supervisor-ide-config.json /ide/

# cli config
COPY --from=code_installer /ide/bin /ide/bin
ENV GITPOD_ENV_APPEND_PATH /ide/bin:

# editor config
ENV GITPOD_ENV_SET_EDITOR /ide/bin/code
ENV GITPOD_ENV_SET_VISUAL "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GP_OPEN_EDITOR "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR "$GITPOD_ENV_SET_EDITOR --wait"
ENV GITPOD_ENV_SET_GP_PREVIEW_BROWSER "/ide/bin/code --preview"
ENV GITPOD_ENV_SET_GP_EXTERNAL_BROWSER "/ide/bin/code --openExternal"
