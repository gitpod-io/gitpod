# Copyright (c) 2023 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.


FROM gitpod/openvscode-server-linux-build-agent:bionic-x64 as code_builder

ARG CODE_COMMIT

ARG NODE_VERSION=16.19.0
ARG NVM_DIR="/root/.nvm"
RUN mkdir -p $NVM_DIR \
    && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | sh \
    && . $NVM_DIR/nvm.sh \
    && nvm alias default $NODE_VERSION
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

RUN mkdir /gp-code \
    && cd /gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/openvscode-server \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code
ENV npm_config_arch=x64

RUN yarn --frozen-lockfile --network-timeout 180000 \
    && yarn --cwd extensions compile \
    && yarn gulp gitpod:bundle-extension:gitpod-web

FROM scratch
# ensures right permissions
COPY --from=code_builder --chown=33333:33333 /gp-code/out-gitpod-marketplace/gitpod-web /ide/extensions/gitpod-web
