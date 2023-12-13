# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM ubuntu:22.04 as code_builder

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV VSCODE_ARCH=x64

ARG CODE_COMMIT
ARG CODE_QUALITY
ARG CODE_VERSION

RUN mkdir /gp-code \
    && cd /gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/openvscode-server \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code
ENV npm_config_arch=x64
RUN mkdir -p .build \
    && yarn --cwd build --frozen-lockfile --network-timeout 180000 \
    && ./build/azure-pipelines/linux/install.sh

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

RUN yarn gulp compile-build \
    && yarn gulp extensions-ci \
    && yarn gulp minify-vscode-reh \
    && yarn gulp vscode-web-min-ci \
    && yarn gulp vscode-reh-linux-x64-min-ci

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
