# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM scratch

COPY bin /ide/bin
COPY startup.sh /ide/
COPY supervisor-ide-config.json  /ide/
COPY index.html  /ide/

RUN chmod -R ugo+x /ide/bin
RUN chmod -R ugo+x /ide/startup.sh

ENV GITPOD_ENV_APPEND_PATH /ide/bin:

# editor config
ENV GITPOD_ENV_SET_EDITOR code
ENV GITPOD_ENV_SET_VISUAL "$GITPOD_ENV_SET_EDITOR"
ENV GITPOD_ENV_SET_GIT_EDITOR "$GITPOD_ENV_SET_EDITOR --wait"
