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


FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-12 as code_installer
# see https://github.com/gitpod-io/vscode/blob/bdeca3f8709b70b339f41fc2a14e94f83d6475ac/.github/workflows/ci.yml#L130
RUN sudo apt-get update \
	&& sudo apt-get -y install --no-install-recommends libxkbfile-dev pkg-config libsecret-1-dev libxss1 dbus xvfb libgtk-3-0 libgbm1 \
	# Clean up
	&& sudo apt-get autoremove -y \
	&& sudo apt-get clean -y \
	&& rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/gitpod-io/vscode.git --branch gp-code --single-branch gp-code
WORKDIR /gp-code
RUN yarn && yarn gulp gitpod-min


FROM alpine:3.9 AS builder_alpine

RUN apk add --no-cache bash gcc g++ make pkgconfig python libc6-compat libexecinfo-dev git patchelf findutils git

# install code
COPY --from=code_installer /gitpod-pkg/ /ide/

# install node
COPY --from=node_installer /ide/node/ /ide/node/
ENV PATH=$PATH:/ide/node/bin/

# copy native dependencies of node
COPY package-libs.sh /usr/bin/
RUN package-libs.sh /ide/node/bin/node

# copy native dependencies of node modules
RUN find /ide/node_modules -iname *.node -exec package-libs.sh {} \;

# rename node executable
RUN cp /ide/node/bin/node /ide/node/bin/gitpod-node && rm /ide/node/bin/node

FROM scratch
COPY --from=builder_alpine /ide/ /ide/

COPY startup.sh /ide/startup.sh