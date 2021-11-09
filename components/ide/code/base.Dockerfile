# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM ubuntu:18.04

# we use latest major version of Node.js distributed VS Code. (see about dialog in your local VS Code)
# ideallay we should use exact version, but it has criticla bugs in regards to grpc over http2 streams
ARG NODE_VERSION=14.18.1

RUN apt-get update \
    # see https://github.com/microsoft/vscode/blob/42e271dd2e7c8f320f991034b62d4c703afb3e28/.github/workflows/ci.yml#L94
    && apt-get -y install --no-install-recommends libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 libgbm1 \
    && apt-get -y install --no-install-recommends git curl build-essential libssl-dev ca-certificates python \
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

ENV NVM_DIR /root/.nvm
RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | sh \
    && . $NVM_DIR/nvm.sh  \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && npm install -g yarn node-gyp
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH
