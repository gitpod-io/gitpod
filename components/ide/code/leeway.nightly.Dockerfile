# Copyright (c) 2024 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.
FROM gitpod/openvscode-server-linux-build-agent:centos7-devtoolset8-x64 as dependencies_builder

ENV TRIGGER_REBUILD 1

ARG CODE_COMMIT

RUN mkdir /gp-code \
    && cd /gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/openvscode-server \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code/remote

RUN npm ci

FROM ubuntu:22.04 as code_builder

ARG DEBIAN_FRONTEND=noninteractive

ENV TRIGGER_REBUILD 1

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV VSCODE_ARCH=x64
ENV NPM_REGISTRY=https://registry.npmjs.org
ENV NODE_VERSION=20

ARG CODE_COMMIT
ARG CODE_QUALITY
ARG CODE_VERSION

# Latest stable git
RUN apt-get update && apt-get install -y software-properties-common
RUN add-apt-repository ppa:git-core/ppa -y

RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    file \
    git \
    gnome-keyring \
    iproute2 \
    libfuse2 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libgl1 \
    libgtk-3.0 \
    libsecret-1-dev \
    libssl-dev \
    libx11-dev \
    libx11-xcb-dev \
    libxkbfile-dev \
    locales \
    lsb-release \
    lsof \
    python3-pip \
    sudo \
    wget \
    xvfb \
    tzdata \
    unzip \
    jq

# Set python3 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3 1
RUN python --version

# Check compiler toolchain
RUN gcc --version
RUN g++ --version

RUN sudo mkdir -m 0755 -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_VERSION.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install -y nodejs

RUN mkdir /gp-code \
    && cd /gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/openvscode-server \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code

RUN apt-get install -y pkg-config dbus xvfb libgtk-3-0 libxkbfile-dev libkrb5-dev libgbm1 rpm \
    && cp build/azure-pipelines/linux/xvfb.init /etc/init.d/xvfb \
    && chmod +x /etc/init.d/xvfb \
    && update-rc.d xvfb defaults \
    && service xvfb start \
    # Start dbus session
    && mkdir -p /var/run/dbus

ENV npm_config_arch=x64
RUN mkdir -p .build \
    && npm config set registry "$NPM_REGISTRY" \
    && npm ci

# copy remote dependencies build in dependencies_builder image
RUN rm -rf remote/node_modules/
COPY --from=dependencies_builder /gp-code/remote/node_modules/ /gp-code/remote/node_modules/

# check that the provided codeVersion is the correct one for the given codeCommit
RUN commitVersion=$(cat package.json | jq -r .version) \
    && if [ "$commitVersion" != "$CODE_VERSION" ]; then echo "Code version mismatch: $commitVersion != $CODE_VERSION"; exit 1; fi

# update product.json
RUN nameShort=$(jq --raw-output '.nameShort' product.json) && \
    nameLong=$(jq --raw-output '.nameLong' product.json) && \
    if [ "$CODE_QUALITY" = "insider" ]; then \
        nameShort="$nameShort - Insiders" \
        nameLong="$nameLong - Insiders" \
    ; fi  && \
    setQuality="setpath([\"quality\"]; \"$CODE_QUALITY\")" && \
    setNameShort="setpath([\"nameShort\"]; \"$nameShort\")" && \
    setNameLong="setpath([\"nameLong\"]; \"$nameLong\")" && \
    setSegmentKey="setpath([\"segmentKey\"]; \"untrusted-dummy-key\")" && \
    jqCommands="${setQuality} | ${setNameShort} | ${setNameLong} | ${setSegmentKey}" && \
    cat product.json | jq "${jqCommands}" > product.json.tmp && \
    mv product.json.tmp product.json && \
    jq '{quality,nameLong,nameShort}' product.json

RUN npm run gulp compile-build
RUN npm run gulp extensions-ci
RUN npm run gulp minify-vscode-reh
RUN npm run gulp vscode-web-min-ci
RUN npm run gulp vscode-reh-linux-x64-min-ci

# config for first layer needed by blobserve
# this custom urls will be then replaced by blobserve.
# Check pkg/blobserve/blobserve.go, `inlineVars` method
RUN cp /vscode-web/out/vs/gitpod/browser/workbench/workbench.html /vscode-web/index.html \
&& cp /vscode-web/out/vs/gitpod/browser/workbench/callback.html /vscode-web/callback.html \
&& sed -i -e "s/{{VERSION}}/$CODE_QUALITY-$CODE_COMMIT/g" /vscode-web/index.html

# cli config: alises to gitpod-code
RUN cp /vscode-reh-linux-x64/bin/remote-cli/gitpod-code /vscode-reh-linux-x64/bin/remote-cli/code \
&& cp /vscode-reh-linux-x64/bin/remote-cli/gitpod-code /vscode-reh-linux-x64/bin/remote-cli/gp-code \
&& cp /vscode-reh-linux-x64/bin/remote-cli/gitpod-code /vscode-reh-linux-x64/bin/remote-cli/open

# grant write permissions for built-in extensions
RUN chmod -R ugo+w /vscode-reh-linux-x64/extensions

FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --from=code_builder --chown=33333:33333 /vscode-web/ /ide/
COPY --from=code_builder --chown=33333:33333 /vscode-reh-linux-x64/ /ide/

ARG CODE_VERSION
ARG CODE_COMMIT
LABEL "io.gitpod.ide.version"=$CODE_VERSION
LABEL "io.gitpod.ide.commit"=$CODE_COMMIT
