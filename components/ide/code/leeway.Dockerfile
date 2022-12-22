# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM gitpod/openvscode-server-linux-build-agent:centos7-devtoolset8-x64 as dependencies_builder

ARG CODE_COMMIT

RUN mkdir /gp-code \
    && cd /gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/openvscode-server \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code
RUN yarn --cwd remote --frozen-lockfile --network-timeout 180000


FROM gitpod/openvscode-server-linux-build-agent:bionic-x64 as code_builder

ARG CODE_COMMIT
ARG CODE_QUALITY
ARG CODE_VERSION

ARG NODE_VERSION=16.18.1
ARG NVM_DIR="/root/.nvm"
RUN mkdir -p $NVM_DIR \
    && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | sh \
    && . $NVM_DIR/nvm.sh \
    && nvm alias default $NODE_VERSION
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

RUN mkdir /gp-code \
    && cd /gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/openvscode-server \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code
ENV npm_config_arch=x64
RUN yarn --frozen-lockfile --network-timeout 180000

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
    setExtensionsGalleryItemUrl="setpath([\"extensionsGallery\", \"itemUrl\"]; \"{{extensionsGalleryItemUrl}}\")" && \
    addTrustedDomain=".linkProtectionTrustedDomains += [\"{{trustedDomain}}\"]" && \
    jqCommands="${setQuality} | ${setNameShort} | ${setNameLong} | ${setExtensionsGalleryItemUrl} | ${addTrustedDomain}" && \
    cat product.json | jq "${jqCommands}" > product.json.tmp && \
    mv product.json.tmp product.json && \
    jq '{quality,nameLong,nameShort}' product.json

RUN yarn --cwd extensions compile \
    && yarn gulp vscode-web-min \
    && yarn gulp vscode-reh-linux-x64-min

# config for first layer needed by blobserve
# we also remove `static/` from resource urls as that's needed by blobserve,
# this custom urls will be then replaced by blobserve.
# Check pkg/blobserve/blobserve.go, `inlineVars` method
RUN cp /vscode-web/out/vs/gitpod/browser/workbench/workbench.html /vscode-web/index.html \
    && cp /vscode-web/out/vs/gitpod/browser/workbench/callback.html /vscode-web/callback.html \
    # TODO: remove next line when workbench.html changes are merged to gp-code/main
    && sed -i -e 's#static/##g' /vscode-web/index.html \
    && sed -i -e 's#baseUrl =.*;#baseUrl = window.location.origin;#g' /vscode-web/index.html \
    && sed -i -e 's#{{WORKBENCH_WEB_BASE_URL}}#.#g' /vscode-web/index.html \
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
COPY --chown=33333:33333 supervisor-ide-config.json components-ide-code-codehelper--app/codehelper /ide/

ENV GITPOD_ENV_APPEND_PATH=/ide/bin/remote-cli:

# editor config
ENV GITPOD_ENV_SET_EDITOR=/ide/bin/remote-cli/gitpod-code
ENV GITPOD_ENV_SET_VISUAL="$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GP_OPEN_EDITOR="$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR="$GITPOD_ENV_SET_EDITOR --wait"
ENV GITPOD_ENV_SET_GP_PREVIEW_BROWSER="/ide/bin/remote-cli/gitpod-code --preview"
ENV GITPOD_ENV_SET_GP_EXTERNAL_BROWSER="/ide/bin/remote-cli/gitpod-code --openExternal"

ARG CODE_VERSION
ARG CODE_COMMIT
LABEL "io.gitpod.ide.version"=$CODE_VERSION
LABEL "io.gitpod.ide.commit"=$CODE_COMMIT
