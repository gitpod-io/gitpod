# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.
FROM node:20 as ide_installer

ARG XTERM_COMMIT

RUN apt update -y \
    && apt install python3 --no-install-recommends -y

RUN mkdir /build \
    && cd /build \
    && git init \
    && git remote add origin https://github.com/gitpod-io/xterm-web-ide \
    && git fetch origin $XTERM_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /build
RUN yarn --frozen-lockfile --network-timeout 180000
RUN yarn build \
    && cp -r dist/ /ide/ \
    && rm -rf dist/ \
    && yarn package:server \
    && echo ${XTERM_COMMIT} > dist/commit.txt \
    && cp -r dist/ out-server/ \
    && chmod -R ugo+x /ide \
    && cp icon.svg /ide/icon.svg

FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --chown=33333:33333 --from=ide_installer /ide/ /ide/xterm
COPY --chown=33333:33333 --from=ide_installer /build/out-server/ /ide/xterm
COPY --chown=33333:33333 --from=ide_installer /build/node_modules/node/bin/node /ide/xterm/bin/
COPY --chown=33333:33333 --from=ide_installer /build/startup.sh /ide/xterm
COPY --chown=33333:33333 --from=ide_installer /build/supervisor-ide-config.json /ide/

ARG XTERM_COMMIT
ARG XTERM_VERSION
LABEL "io.gitpod.ide.commit"=$XTERM_COMMIT
LABEL "io.gitpod.ide.version"=$XTERM_VERSION
