# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# BUILDER_BASE is a placeholder, will be replaced before build time
# Check BUILD.yaml
FROM BUILDER_BASE as code_installer

ARG CODE_COMMIT

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD 1
ENV ELECTRON_SKIP_BINARY_DOWNLOAD 1

RUN mkdir gp-code \
    && cd gp-code \
    && git init \
    && git remote add origin https://github.com/gitpod-io/vscode \
    && git fetch origin $CODE_COMMIT --depth=1 \
    && git reset --hard FETCH_HEAD
WORKDIR /gp-code
RUN yarn --frozen-lockfile --network-timeout 180000
RUN yarn --cwd ./extensions compile
RUN yarn gulp vscode-web
RUN yarn gulp vscode-reh-linux-x64

# config for first layer needed by blobserve
# we also remove `static/` from resource urls as that's needed by blobserve,
# this custom urls will be then replaced by blobserve.
# Check pkg/blobserve/blobserve.go, `inlineVars` method
RUN cp /vscode-web/out/vs/gitpod/browser/workbench/workbench.html /vscode-web/index.html \
    && sed -i -e 's#static/##g' /vscode-web/index.html

# cli config: alises to gitpod-code
# can't use relative symlink as they break when copied to the image below
COPY bin /ide/bin
RUN chmod -R ugo+x /ide/bin

# grant write permissions for built-in extensions
RUN chmod -R ugo+w /vscode-reh-linux-x64/extensions

FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --from=code_installer --chown=33333:33333 /vscode-web/ /ide/
COPY --from=code_installer --chown=33333:33333 /vscode-reh-linux-x64/ /ide/
COPY --chown=33333:33333 startup.sh supervisor-ide-config.json /ide/

COPY --from=code_installer --chown=33333:33333 /ide/bin /ide/bin/remote-cli

ENV GITPOD_ENV_APPEND_PATH /ide/bin/remote-cli:

# editor config
ENV GITPOD_ENV_SET_EDITOR /ide/bin/remote-cli/gitpod-code
ENV GITPOD_ENV_SET_VISUAL "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GP_OPEN_EDITOR "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR "$GITPOD_ENV_SET_EDITOR --wait"
ENV GITPOD_ENV_SET_GP_PREVIEW_BROWSER "/ide/bin/remote-cli/gitpod-code --preview"
ENV GITPOD_ENV_SET_GP_EXTERNAL_BROWSER "/ide/bin/remote-cli/gitpod-code --openExternal"
