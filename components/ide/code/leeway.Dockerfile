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
RUN yarn gulp gitpod-min

# grant write permissions for built-in extensions
RUN chmod -R ugo+w /gitpod-pkg-server/extensions

# cli config
COPY bin /ide/bin
RUN chmod -R ugo+x /ide/bin


FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --from=code_installer --chown=33333:33333 /gitpod-pkg-web/ /ide/
COPY --from=code_installer --chown=33333:33333 /gitpod-pkg-server/ /ide/
COPY --chown=33333:33333 startup.sh supervisor-ide-config.json /ide/

# cli config
COPY --from=code_installer --chown=33333:33333 /ide/bin /ide/bin
ENV GITPOD_ENV_APPEND_PATH /ide/bin:

# editor config
ENV GITPOD_ENV_SET_EDITOR /ide/bin/code
ENV GITPOD_ENV_SET_VISUAL "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GP_OPEN_EDITOR "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR "$GITPOD_ENV_SET_EDITOR --wait"
ENV GITPOD_ENV_SET_GP_PREVIEW_BROWSER "/ide/bin/code --preview"
ENV GITPOD_ENV_SET_GP_EXTERNAL_BROWSER "/ide/bin/code --openExternal"
