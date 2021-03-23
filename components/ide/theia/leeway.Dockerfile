# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

################ Alpine ####################
# copy nodejs from the official alpine-based image because of https://github.com/TypeFox/gitpod/issues/2579
FROM node:12.14.1-alpine AS node_installer
RUN mkdir -p /theia/node/bin \
    /theia/node/include/node/ \
    /theia/node/lib/node_modules/npm/ \
    /theia/node/lib/ && \
    cp -a  /usr/local/bin/node              /theia/node/bin/ && \
    cp -a  /usr/local/bin/npm               /theia/node/bin/ && \
    cp -a  /usr/local/bin/npx               /theia/node/bin/ && \
    cp -ar /usr/local/include/node/         /theia/node/include/ && \
    cp -ar /usr/local/lib/node_modules/npm/ /theia/node/lib/node_modules/

FROM alpine:3.9 AS builder_alpine

RUN apk add --no-cache bash gcc g++ make pkgconfig python libc6-compat libexecinfo-dev git patchelf findutils curl jq

# install node
COPY --from=node_installer /theia/node/ /theia/node/
ENV PATH=$PATH:/theia/node/bin/


# install yarn by download+unpack to ensure it does NOT put anything into /theia/node/
RUN wget https://github.com/yarnpkg/yarn/releases/download/v1.15.2/yarn-v1.15.2.tar.gz
RUN tar zvxf yarn-v1.15.2.tar.gz
ENV PATH=$PATH:/yarn-v1.15.2/bin/

# yq - jq for YAML files
RUN cd /usr/bin \
    && curl -fsSL https://github.com/mikefarah/yq/releases/download/2.4.0/yq_linux_amd64 > yq \
    && chmod +x yq
ENV PATH=$PATH:/usr/bin/


WORKDIR /theia

ENV THEIA_APP_COMMIT a8692818b877a1bda1fd1c1b1021f703a27c1b56
RUN mkdir theia-app \
    && cd theia-app \
    && git init \
    && git remote add origin https://github.com/gitpod-io/theia-app \
    && git fetch origin $THEIA_APP_COMMIT \
    && git reset --hard FETCH_HEAD


WORKDIR /theia/theia-app
RUN yarn
RUN yarn build

# patching plugin ext host process to fix css extension compatibility, see https://github.com/gitpod-io/gitpod/pull/2483
RUN yarn patch-package


# download builtin plugins
RUN cd /theia/theia-app \
    && sh ./scripts/builtin-plugins.sh


# copy native dependencies of node
COPY package-libs.sh /usr/bin/
RUN package-libs.sh /theia/node/bin/node

# copy native dependencies of node modules
RUN find /theia/theia-app/node_modules/ -iname *.node -exec package-libs.sh {} \;

RUN cp /theia/node/bin/node /theia/node/bin/gitpod-node && rm /theia/node/bin/node


# cli config
COPY bin /ide/bin
RUN chmod -R ugo+x /ide/bin

FROM scratch
COPY --from=builder_alpine /theia/ /theia/

ENV GITPOD_ENV_SET_GITPOD_BUILT_IN_PLUGINS /theia/theia-app/plugins/

# standard supervisor entrypoint used when supervisor isn't coming from this image
WORKDIR /ide/
COPY supervisor-ide-config.json /ide/

COPY startup.sh supervisor-ide-config.json /theia/

# cli config
COPY --from=builder_alpine /ide/bin /ide/bin
ENV GITPOD_ENV_APPEND_PATH /ide/bin:

# editor config
ENV GITPOD_ENV_SET_EDITOR "gp open -w"
ENV GITPOD_ENV_SET_VISUAL "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR "$GITPOD_ENV_SET_EDITOR"