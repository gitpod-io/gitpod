# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


################ Alpine ####################
# copy nodejs from the official alpine-based image because of https://github.com/TypeFox/gitpod/issues/2579
FROM node:12.18.3-alpine AS node_installer
RUN mkdir -p /ide/node/bin \
             /ide/node/include/node/ \
             /ide/node/lib/node_modules/npm/ \
             /ide/node/lib/ && \
    cp -a  /usr/local/bin/node              /ide/node/bin/ && \
    cp -a  /usr/local/bin/npm               /ide/node/bin/ && \
    cp -a  /usr/local/bin/npx               /ide/node/bin/ && \
    cp -ar /usr/local/include/node/         /ide/node/include/ && \
    cp -ar /usr/local/lib/node_modules/npm/ /ide/node/lib/node_modules/

FROM alpine:3.9 AS builder_alpine

RUN apk add --no-cache bash gcc g++ make pkgconfig python libc6-compat libexecinfo-dev git patchelf findutils

# install node
COPY --from=node_installer /ide/node/ /ide/node/
ENV PATH=$PATH:/ide/node/bin/

# install yarn by download+unpack to ensure it does NOT put anything into /ide/node/
RUN wget https://github.com/yarnpkg/yarn/releases/download/v1.15.2/yarn-v1.15.2.tar.gz
RUN tar zvxf yarn-v1.15.2.tar.gz
ENV PATH=$PATH:/yarn-v1.15.2/bin/

COPY components-theia-app--installer /ide-installer
WORKDIR /ide
RUN /ide-installer/install.sh

# copy native dependencies of node
COPY package-libs.sh /usr/bin/
RUN package-libs.sh /ide/node/bin/node

# copy native dependencies of node modules
RUN find /ide/node_modules/ -iname *.node -exec package-libs.sh {} \;


FROM scratch
COPY --from=builder_alpine /ide/ /ide/
COPY --from=builder_alpine /ide/node/bin/node /ide/node/bin/gitpod-node
COPY startup.sh /ide/startup.sh

ENV GITPOD_BUILT_IN_PLUGINS /ide/node_modules/@gitpod/gitpod-ide/plugins/
COPY components-theia-app--builtin-plugins/plugins/ ${GITPOD_BUILT_IN_PLUGINS}

WORKDIR "/ide"